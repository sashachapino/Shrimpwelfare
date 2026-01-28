"""
Atmospheric GUI for Vinyl Ambient generator.

A moody, minimal interface where a photograph serves as a play/pause button
for continuous ambient streaming - like a haunted radio.
"""

import threading
import queue
import tkinter as tk
from tkinter import ttk, filedialog, Canvas
from pathlib import Path
from typing import Optional
import random
import time

import numpy as np

try:
    import sounddevice as sd
    HAS_SOUNDDEVICE = True
except ImportError:
    HAS_SOUNDDEVICE = False

try:
    from PIL import Image, ImageTk, ImageFilter, ImageDraw
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from .effects import EffectSettings, process_sample, create_effect_preset
from .archive_fetcher import fetch_random_vinyl_sample


# Color palette
COLORS = {
    "bg_dark": "#0a0a0a",
    "bg_medium": "#1a1a1a",
    "text_muted": "#6a6a6a",
    "text_light": "#9a9a9a",
    "accent": "#c4a882",
    "accent_dim": "#7a6a52",
    "playing": "#8fa882",
}

IMAGE_WIDTH = 400
IMAGE_HEIGHT = 500


def generate_atmospheric_image(width: int = 400, height: int = 500) -> "Image.Image":
    """Generate a procedural atmospheric image."""
    if not HAS_PIL:
        return None

    # Create with obvious visible colors for debugging
    img = Image.new("RGB", (width, height), (60, 50, 45))
    draw = ImageDraw.Draw(img)

    # Add visible warm gradient shapes
    for _ in range(4):
        cx = random.randint(50, width - 50)
        cy = random.randint(50, height - 50)

        for radius in range(180, 10, -8):
            brightness = 80 + (180 - radius) // 2
            color = (
                min(255, brightness + 40),
                min(255, brightness + 20),
                min(255, brightness)
            )
            draw.ellipse(
                [cx - radius, cy - int(radius * 1.2),
                 cx + radius, cy + int(radius * 1.2)],
                fill=color
            )

    # Blur
    img = img.filter(ImageFilter.GaussianBlur(radius=25))

    # Add grain
    arr = np.array(img, dtype=np.int16)
    noise = np.random.randint(-12, 12, arr.shape, dtype=np.int16)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)

    return Image.fromarray(arr)


class AudioStreamer:
    """Handles continuous audio streaming - loops samples while fetching new ones."""

    def __init__(self, preset: str = "ghostly", sample_rate: int = 44100):
        self.preset = preset
        self.sample_rate = sample_rate
        self.is_playing = False
        self.audio_queue = queue.Queue(maxsize=5)
        self.current_audio = None
        self.current_position = 0
        self.stream = None
        self.fetch_thread = None
        self.status_callback = None
        self.lock = threading.Lock()

    def set_preset(self, preset: str):
        self.preset = preset

    def set_status_callback(self, callback):
        self.status_callback = callback

    def _update_status(self, text: str):
        if self.status_callback:
            self.status_callback(text)

    def _fetch_worker(self):
        """Background thread that fetches and processes samples."""
        while self.is_playing:
            try:
                if self.audio_queue.qsize() < 3:
                    self._update_status("fetching new vinyl...")
                    sample = fetch_random_vinyl_sample(
                        min_duration=20.0,
                        max_duration=90.0,
                    )
                    if sample:
                        self._update_status("processing...")
                        settings = create_effect_preset(self.preset)
                        # Randomize slightly
                        settings = EffectSettings(
                            slowdown_factor=settings.slowdown_factor * random.uniform(0.85, 1.15),
                            reverb_room_size=settings.reverb_room_size,
                            reverb_damping=settings.reverb_damping,
                            reverb_wet_level=settings.reverb_wet_level,
                            reverb_dry_level=settings.reverb_dry_level,
                            delay_seconds=settings.delay_seconds * random.uniform(0.9, 1.2),
                            delay_feedback=settings.delay_feedback,
                            delay_mix=settings.delay_mix,
                            wow_depth=settings.wow_depth * random.uniform(0.8, 1.3),
                            wow_rate=settings.wow_rate,
                            flutter_depth=settings.flutter_depth,
                            flutter_rate=settings.flutter_rate,
                            lowpass_freq=settings.lowpass_freq,
                            highpass_freq=settings.highpass_freq,
                            noise_level=settings.noise_level,
                            crackle_density=settings.crackle_density,
                            saturation_drive=settings.saturation_drive,
                            output_gain_db=settings.output_gain_db,
                        )
                        processed = process_sample(sample.audio, sample.sample_rate, settings)

                        # Resample if needed
                        if sample.sample_rate != self.sample_rate:
                            from scipy import signal
                            num_samples = int(len(processed) * self.sample_rate / sample.sample_rate)
                            processed = signal.resample(processed, num_samples)

                        self.audio_queue.put(processed)
                        title = sample.source_title[:35] if sample.source_title else "unknown"
                        self._update_status(f"playing: {title}...")
                    else:
                        self._update_status("fetch failed, retrying...")
                        time.sleep(3)
                else:
                    time.sleep(2)
            except Exception as e:
                print(f"Fetch error: {e}")
                self._update_status("error, retrying...")
                time.sleep(3)

    def _audio_callback(self, outdata, frames, time_info, status):
        """Callback for sounddevice stream - loops current sample if queue empty."""
        if not self.is_playing:
            outdata.fill(0)
            return

        with self.lock:
            output = np.zeros(frames, dtype=np.float32)
            remaining = frames
            pos = 0

            while remaining > 0:
                # Try to get new audio if we need it
                if self.current_audio is None or self.current_position >= len(self.current_audio):
                    try:
                        new_audio = self.audio_queue.get_nowait()
                        self.current_audio = new_audio
                        self.current_position = 0
                    except queue.Empty:
                        # Loop current audio if we have it
                        if self.current_audio is not None and len(self.current_audio) > 0:
                            self.current_position = 0
                        else:
                            # No audio yet - output silence
                            output[pos:] = 0
                            break

                if self.current_audio is not None:
                    available = len(self.current_audio) - self.current_position
                    to_copy = min(remaining, available)
                    output[pos:pos + to_copy] = self.current_audio[
                        self.current_position:self.current_position + to_copy
                    ]
                    self.current_position += to_copy
                    pos += to_copy
                    remaining -= to_copy

            outdata[:, 0] = output * 0.7

    def start(self):
        """Start streaming audio."""
        if not HAS_SOUNDDEVICE:
            self._update_status("sounddevice not installed")
            return

        self.is_playing = True
        self.current_audio = None
        self.current_position = 0

        # Clear any old audio
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break

        # Start fetch thread
        self.fetch_thread = threading.Thread(target=self._fetch_worker, daemon=True)
        self.fetch_thread.start()

        # Start audio stream
        try:
            self.stream = sd.OutputStream(
                samplerate=self.sample_rate,
                channels=1,
                callback=self._audio_callback,
                blocksize=2048,
                dtype=np.float32,
            )
            self.stream.start()
            self._update_status("starting stream...")
        except Exception as e:
            print(f"Audio stream error: {e}")
            self._update_status(f"audio error: {e}")
            self.is_playing = False

    def stop(self):
        """Stop streaming."""
        self.is_playing = False
        if self.stream:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None
        self._update_status("stopped")


class VinylAmbientGUI:
    """Atmospheric GUI for continuous vinyl ambient streaming."""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("vinyl ambient")
        self.root.configure(bg=COLORS["bg_dark"])
        self.root.resizable(False, False)

        self.is_playing = False
        self.current_preset = "ghostly"
        self.custom_image_path: Optional[Path] = None
        self.streamer = AudioStreamer(preset=self.current_preset)
        self.streamer.set_status_callback(self._update_status_threadsafe)
        self.photo_image = None  # Keep reference

        self._setup_ui()
        self._create_image()

    def _setup_ui(self):
        """Build the interface."""
        self.main_frame = tk.Frame(self.root, bg=COLORS["bg_dark"], padx=40, pady=30)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        tk.Label(
            self.main_frame,
            text="vinyl ambient",
            font=("Helvetica", 14),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        ).pack(pady=(0, 20))

        # Canvas for the image (more reliable than Label)
        self.canvas = Canvas(
            self.main_frame,
            width=IMAGE_WIDTH,
            height=IMAGE_HEIGHT,
            bg=COLORS["bg_medium"],
            highlightthickness=2,
            highlightbackground=COLORS["text_muted"],
            cursor="hand2",
        )
        self.canvas.pack()
        self.canvas.bind("<Button-1>", self._on_click)
        self.canvas.bind("<Enter>", self._on_hover_enter)
        self.canvas.bind("<Leave>", self._on_hover_leave)

        # Instruction
        self.instruction_label = tk.Label(
            self.main_frame,
            text="click to play",
            font=("Helvetica", 10),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        self.instruction_label.pack(pady=(15, 5))

        # Status
        self.status_label = tk.Label(
            self.main_frame,
            text="",
            font=("Helvetica", 9),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        self.status_label.pack(pady=(5, 15))

        # Controls
        controls = tk.Frame(self.main_frame, bg=COLORS["bg_dark"])
        controls.pack(fill=tk.X, pady=(10, 0))

        tk.Label(
            controls, text="mood", font=("Helvetica", 9),
            fg=COLORS["text_muted"], bg=COLORS["bg_dark"],
        ).pack(side=tk.LEFT)

        self.preset_var = tk.StringVar(value=self.current_preset)
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Dark.TCombobox",
            fieldbackground=COLORS["bg_medium"],
            background=COLORS["bg_medium"],
            foreground=COLORS["text_light"],
        )

        self.preset_combo = ttk.Combobox(
            controls,
            textvariable=self.preset_var,
            values=["default", "deep", "ghostly", "submerged", "nostalgic", "drone"],
            state="readonly",
            width=12,
            style="Dark.TCombobox",
        )
        self.preset_combo.pack(side=tk.LEFT, padx=(10, 20))
        self.preset_combo.bind("<<ComboboxSelected>>", self._on_preset_change)

        load_btn = tk.Label(
            controls, text="load image", font=("Helvetica", 9),
            fg=COLORS["text_muted"], bg=COLORS["bg_dark"], cursor="hand2",
        )
        load_btn.pack(side=tk.RIGHT)
        load_btn.bind("<Button-1>", self._load_custom_image)
        load_btn.bind("<Enter>", lambda e: load_btn.configure(fg=COLORS["accent"]))
        load_btn.bind("<Leave>", lambda e: load_btn.configure(fg=COLORS["text_muted"]))

    def _create_image(self):
        """Create and display the image on canvas."""
        if not HAS_PIL:
            self.canvas.create_text(
                IMAGE_WIDTH // 2, IMAGE_HEIGHT // 2,
                text="[ click to play ]",
                fill=COLORS["text_muted"],
                font=("Helvetica", 14),
            )
            return

        try:
            if self.custom_image_path and self.custom_image_path.exists():
                img = Image.open(self.custom_image_path)
                img = img.resize((IMAGE_WIDTH, IMAGE_HEIGHT), Image.Resampling.LANCZOS)
                img = img.convert("L").convert("RGB")
                img = img.filter(ImageFilter.GaussianBlur(radius=1))
            else:
                img = generate_atmospheric_image(IMAGE_WIDTH, IMAGE_HEIGHT)

            if img:
                self.photo_image = ImageTk.PhotoImage(img)
                self.canvas.delete("all")
                self.canvas.create_image(0, 0, anchor=tk.NW, image=self.photo_image)
                print(f"Image created and displayed: {IMAGE_WIDTH}x{IMAGE_HEIGHT}")
        except Exception as e:
            print(f"Image error: {e}")
            self.canvas.create_text(
                IMAGE_WIDTH // 2, IMAGE_HEIGHT // 2,
                text="[ click to play ]",
                fill=COLORS["text_muted"],
                font=("Helvetica", 14),
            )

    def _on_click(self, event):
        """Toggle play/pause."""
        if self.is_playing:
            self._stop_playback()
        else:
            self._start_playback()

    def _start_playback(self):
        self.is_playing = True
        self.instruction_label.configure(text="click to stop", fg=COLORS["playing"])
        self.canvas.configure(highlightbackground=COLORS["playing"])
        self.streamer.set_preset(self.current_preset)
        self.streamer.start()

    def _stop_playback(self):
        self.is_playing = False
        self.instruction_label.configure(text="click to play", fg=COLORS["text_muted"])
        self.canvas.configure(highlightbackground=COLORS["text_muted"])
        self.streamer.stop()

    def _on_hover_enter(self, event):
        color = COLORS["accent"] if self.is_playing else COLORS["accent_dim"]
        self.canvas.configure(highlightbackground=color)

    def _on_hover_leave(self, event):
        color = COLORS["playing"] if self.is_playing else COLORS["text_muted"]
        self.canvas.configure(highlightbackground=color)

    def _on_preset_change(self, event):
        self.current_preset = self.preset_var.get()
        self.streamer.set_preset(self.current_preset)

    def _load_custom_image(self, event):
        path = filedialog.askopenfilename(
            filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp *.tiff")],
            title="choose image",
        )
        if path:
            self.custom_image_path = Path(path)
            self._create_image()

    def _update_status_threadsafe(self, text: str):
        self.root.after(0, lambda: self.status_label.configure(text=text))

    def run(self):
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() // 2) - (IMAGE_WIDTH // 2 + 40)
        y = (self.root.winfo_screenheight() // 2) - (IMAGE_HEIGHT // 2 + 100)
        self.root.geometry(f"+{x}+{y}")
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.mainloop()

    def _on_close(self):
        if self.is_playing:
            self.streamer.stop()
        self.root.destroy()


def main():
    if not HAS_PIL:
        print("Warning: Pillow not installed")
    if not HAS_SOUNDDEVICE:
        print("Warning: sounddevice not installed")
    app = VinylAmbientGUI()
    app.run()


if __name__ == "__main__":
    main()
