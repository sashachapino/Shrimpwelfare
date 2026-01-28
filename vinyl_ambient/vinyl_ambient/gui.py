"""
Atmospheric GUI for Vinyl Ambient generator.

A moody, minimal interface where a photograph serves as a play/pause button
for continuous ambient streaming - like a haunted radio.
"""

import threading
import queue
import tkinter as tk
from tkinter import ttk, filedialog
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


# Color palette - muted, atmospheric
COLORS = {
    "bg_dark": "#0a0a0a",
    "bg_medium": "#1a1a1a",
    "text_muted": "#6a6a6a",
    "text_light": "#9a9a9a",
    "accent": "#c4a882",
    "accent_dim": "#7a6a52",
    "playing": "#8fa882",
}


def generate_atmospheric_image(width: int = 400, height: int = 500) -> "Image.Image":
    """
    Generate a procedural atmospheric image with Saul Leiter-esque qualities.
    """
    if not HAS_PIL:
        return None

    # Start with a warmer, more visible base
    img = Image.new("RGB", (width, height), (20, 18, 15))
    draw = ImageDraw.Draw(img)

    # Add larger, more visible abstract shapes
    for _ in range(random.randint(3, 5)):
        x = random.randint(-100, width - 50)
        y = random.randint(-100, height - 50)
        w = random.randint(150, 350)
        h = random.randint(200, 450)

        # Brighter, more visible colors
        colors = [
            (70, 60, 50),    # Warm brown
            (80, 70, 60),    # Light sepia
            (60, 55, 65),    # Cool violet-gray
            (90, 75, 60),    # Golden brown
            (50, 50, 55),    # Blue-gray
        ]
        color = random.choice(colors)

        # Build up layers for soft edges
        for i in range(25, 0, -1):
            expand = i * 4
            brightness_boost = i * 3
            layer_color = tuple(min(255, c + brightness_boost) for c in color)
            draw.ellipse(
                [x - expand, y - expand, x + w + expand, y + h + expand],
                fill=layer_color
            )

    # Add prominent light sources (like window light falling on skin)
    for _ in range(random.randint(2, 3)):
        x = random.randint(width // 6, 5 * width // 6)
        y = random.randint(height // 6, 4 * height // 6)

        for i in range(40, 0, -1):
            # Warmer, brighter light
            brightness = 50 + i * 2
            r = min(255, brightness + 20)
            g = min(255, brightness + 10)
            b = min(255, brightness - 10)
            draw.ellipse(
                [x - i * 5, y - i * 4, x + i * 5, y + i * 6],
                fill=(r, g, b)
            )

    # Soften with blur
    img = img.filter(ImageFilter.GaussianBlur(radius=25))

    # Add film grain
    img_array = np.array(img)
    noise = np.random.normal(0, 12, img_array.shape).astype(np.int16)
    img_array = np.clip(img_array.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(img_array)

    # Add vignette
    vignette = Image.new("L", (width, height), 0)
    vignette_draw = ImageDraw.Draw(vignette)
    for i in range(min(width, height) // 2):
        gray = int(255 * (i / (min(width, height) / 2)) ** 0.7)
        vignette_draw.ellipse(
            [width//2 - i*2, height//2 - i*2, width//2 + i*2, height//2 + i*2],
            fill=gray
        )

    # Apply vignette
    img_array = np.array(img)
    vignette_array = np.array(vignette)[:, :, np.newaxis] / 255.0
    img_array = (img_array * vignette_array).astype(np.uint8)
    img = Image.fromarray(img_array)

    # Slight warm tint
    img_array = np.array(img).astype(np.float32)
    img_array[:, :, 0] = np.clip(img_array[:, :, 0] * 1.1, 0, 255)  # Red
    img_array[:, :, 2] = np.clip(img_array[:, :, 2] * 0.9, 0, 255)  # Blue
    img = Image.fromarray(img_array.astype(np.uint8))

    return img


class AudioStreamer:
    """Handles continuous audio streaming with crossfading samples."""

    def __init__(self, preset: str = "ghostly", sample_rate: int = 44100):
        self.preset = preset
        self.sample_rate = sample_rate
        self.is_playing = False
        self.audio_queue = queue.Queue(maxsize=3)
        self.current_audio = None
        self.current_position = 0
        self.stream = None
        self.fetch_thread = None
        self.status_callback = None

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
            if self.audio_queue.qsize() < 2:
                self._update_status("fetching new vinyl...")
                try:
                    sample = fetch_random_vinyl_sample(
                        min_duration=15.0,
                        max_duration=60.0,
                    )
                    if sample:
                        self._update_status("processing...")
                        settings = create_effect_preset(self.preset)
                        # Add some randomization
                        settings = EffectSettings(
                            slowdown_factor=settings.slowdown_factor * random.uniform(0.8, 1.2),
                            reverb_room_size=settings.reverb_room_size,
                            reverb_damping=settings.reverb_damping,
                            reverb_wet_level=settings.reverb_wet_level,
                            reverb_dry_level=settings.reverb_dry_level,
                            delay_seconds=settings.delay_seconds * random.uniform(0.8, 1.3),
                            delay_feedback=settings.delay_feedback,
                            delay_mix=settings.delay_mix,
                            wow_depth=settings.wow_depth * random.uniform(0.7, 1.5),
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
                        self._update_status(f"playing: {sample.source_title[:30]}...")
                except Exception as e:
                    self._update_status(f"fetch error, retrying...")
                    time.sleep(2)
            else:
                time.sleep(1)

    def _audio_callback(self, outdata, frames, time_info, status):
        """Callback for sounddevice stream."""
        if not self.is_playing:
            outdata.fill(0)
            return

        output = np.zeros(frames)
        remaining = frames
        pos = 0

        while remaining > 0:
            if self.current_audio is None or self.current_position >= len(self.current_audio):
                # Need new audio
                try:
                    self.current_audio = self.audio_queue.get_nowait()
                    self.current_position = 0
                except queue.Empty:
                    # Fill with silence if no audio ready
                    output[pos:] = 0
                    break

            # Copy available audio
            available = len(self.current_audio) - self.current_position
            to_copy = min(remaining, available)
            output[pos:pos + to_copy] = self.current_audio[self.current_position:self.current_position + to_copy]
            self.current_position += to_copy
            pos += to_copy
            remaining -= to_copy

        # Apply gentle fade at edges to avoid clicks
        outdata[:, 0] = output * 0.8  # Slight volume reduction

    def start(self):
        """Start streaming audio."""
        if not HAS_SOUNDDEVICE:
            self._update_status("sounddevice not installed")
            return

        self.is_playing = True

        # Start fetch thread
        self.fetch_thread = threading.Thread(target=self._fetch_worker, daemon=True)
        self.fetch_thread.start()

        # Start audio stream
        self.stream = sd.OutputStream(
            samplerate=self.sample_rate,
            channels=1,
            callback=self._audio_callback,
            blocksize=4096,
        )
        self.stream.start()
        self._update_status("starting stream...")

    def stop(self):
        """Stop streaming."""
        self.is_playing = False
        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None
        self._update_status("stopped")

        # Clear queue
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break


class VinylAmbientGUI:
    """Atmospheric GUI for continuous vinyl ambient streaming."""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("vinyl ambient")
        self.root.configure(bg=COLORS["bg_dark"])
        self.root.resizable(False, False)

        # State
        self.is_playing = False
        self.current_preset = "ghostly"
        self.custom_image_path: Optional[Path] = None
        self.streamer = AudioStreamer(preset=self.current_preset)
        self.streamer.set_status_callback(self._update_status_threadsafe)

        self._setup_ui()
        self._load_or_generate_image()

    def _setup_ui(self):
        """Build the atmospheric interface."""
        self.main_frame = tk.Frame(self.root, bg=COLORS["bg_dark"], padx=40, pady=30)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = tk.Label(
            self.main_frame,
            text="vinyl ambient",
            font=("Helvetica Neue", 14, "normal"),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        title.pack(pady=(0, 20))

        # Photo frame (play/pause button)
        self.photo_frame = tk.Frame(
            self.main_frame,
            bg=COLORS["bg_medium"],
            highlightthickness=2,
            highlightbackground=COLORS["text_muted"],
        )
        self.photo_frame.pack()

        self.photo_label = tk.Label(
            self.photo_frame,
            bg=COLORS["bg_medium"],
            cursor="hand2",
        )
        self.photo_label.pack(padx=2, pady=2)
        self.photo_label.bind("<Button-1>", self._on_photo_click)
        self.photo_label.bind("<Enter>", self._on_hover_enter)
        self.photo_label.bind("<Leave>", self._on_hover_leave)

        # Instruction
        self.instruction_label = tk.Label(
            self.main_frame,
            text="click to play",
            font=("Helvetica Neue", 10),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        self.instruction_label.pack(pady=(15, 5))

        # Status
        self.status_label = tk.Label(
            self.main_frame,
            text="",
            font=("Helvetica Neue", 9),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        self.status_label.pack(pady=(5, 15))

        # Controls
        controls = tk.Frame(self.main_frame, bg=COLORS["bg_dark"])
        controls.pack(fill=tk.X, pady=(10, 0))

        preset_label = tk.Label(
            controls,
            text="mood",
            font=("Helvetica Neue", 9),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        preset_label.pack(side=tk.LEFT)

        self.preset_var = tk.StringVar(value=self.current_preset)
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "Dark.TCombobox",
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

        # Load image button
        load_btn = tk.Label(
            controls,
            text="load image",
            font=("Helvetica Neue", 9),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
            cursor="hand2",
        )
        load_btn.pack(side=tk.RIGHT)
        load_btn.bind("<Button-1>", self._load_custom_image)
        load_btn.bind("<Enter>", lambda e: load_btn.configure(fg=COLORS["accent"]))
        load_btn.bind("<Leave>", lambda e: load_btn.configure(fg=COLORS["text_muted"]))

    def _load_or_generate_image(self):
        """Load or generate the atmospheric image."""
        if not HAS_PIL:
            self.photo_label.configure(
                text="[ click to play ]",
                fg=COLORS["text_muted"],
                font=("Helvetica Neue", 12),
                width=40,
                height=20,
            )
            return

        try:
            if self.custom_image_path and self.custom_image_path.exists():
                img = Image.open(self.custom_image_path)
                img.thumbnail((400, 500), Image.Resampling.LANCZOS)
                img = img.convert("L").convert("RGB")
                img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
            else:
                img = generate_atmospheric_image(400, 500)

            if img:
                self.photo_image = ImageTk.PhotoImage(img)
                self.photo_label.configure(image=self.photo_image)
        except Exception as e:
            self.photo_label.configure(
                text="[ click to play ]",
                fg=COLORS["text_muted"],
                font=("Helvetica Neue", 12),
                width=40,
                height=20,
            )

    def _on_photo_click(self, event):
        """Toggle play/pause."""
        if self.is_playing:
            self._stop_playback()
        else:
            self._start_playback()

    def _start_playback(self):
        """Start the ambient stream."""
        self.is_playing = True
        self.instruction_label.configure(text="click to stop", fg=COLORS["playing"])
        self.photo_frame.configure(highlightbackground=COLORS["playing"])
        self.streamer.set_preset(self.current_preset)
        self.streamer.start()

    def _stop_playback(self):
        """Stop the ambient stream."""
        self.is_playing = False
        self.instruction_label.configure(text="click to play", fg=COLORS["text_muted"])
        self.photo_frame.configure(highlightbackground=COLORS["text_muted"])
        self.streamer.stop()

    def _on_hover_enter(self, event):
        if self.is_playing:
            self.photo_frame.configure(highlightbackground=COLORS["accent"])
        else:
            self.photo_frame.configure(highlightbackground=COLORS["accent_dim"])

    def _on_hover_leave(self, event):
        if self.is_playing:
            self.photo_frame.configure(highlightbackground=COLORS["playing"])
        else:
            self.photo_frame.configure(highlightbackground=COLORS["text_muted"])

    def _on_preset_change(self, event):
        self.current_preset = self.preset_var.get()
        self.streamer.set_preset(self.current_preset)

    def _load_custom_image(self, event):
        file_path = filedialog.askopenfilename(
            filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp *.tiff")],
            title="choose image",
        )
        if file_path:
            self.custom_image_path = Path(file_path)
            self._load_or_generate_image()

    def _update_status_threadsafe(self, text: str):
        """Update status from any thread."""
        self.root.after(0, lambda: self.status_label.configure(text=text))

    def run(self):
        """Start the GUI."""
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f"+{x}+{y}")

        # Handle window close
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.mainloop()

    def _on_close(self):
        """Clean up on window close."""
        if self.is_playing:
            self.streamer.stop()
        self.root.destroy()


def main():
    """Launch the GUI."""
    if not HAS_PIL:
        print("Warning: Pillow not installed for atmospheric images")
    if not HAS_SOUNDDEVICE:
        print("Warning: sounddevice not installed - audio playback disabled")
        print("Install with: pip install sounddevice")

    app = VinylAmbientGUI()
    app.run()


if __name__ == "__main__":
    main()
