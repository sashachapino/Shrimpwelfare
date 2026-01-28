"""
Atmospheric GUI for Vinyl Ambient generator.

A moody, minimal interface where a photograph serves as the generate button.
Inspired by the intimate, soft-focus aesthetic of Saul Leiter.
"""

import threading
import tkinter as tk
from tkinter import ttk, filedialog
from pathlib import Path
from typing import Optional
import random

try:
    from PIL import Image, ImageTk, ImageFilter, ImageDraw
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from .effects import list_presets
from .generator import CompositionConfig, generate_ambient_piece


# Color palette - muted, atmospheric
COLORS = {
    "bg_dark": "#0a0a0a",
    "bg_medium": "#1a1a1a",
    "text_muted": "#6a6a6a",
    "text_light": "#9a9a9a",
    "accent": "#c4a882",  # Warm sepia tone
    "accent_dim": "#7a6a52",
}


def generate_atmospheric_image(width: int = 400, height: int = 500) -> "Image.Image":
    """
    Generate a procedural atmospheric image with Saul Leiter-esque qualities:
    soft gradients, grain, abstract forms.
    """
    if not HAS_PIL:
        return None

    # Create base with dark gradient
    img = Image.new("RGB", (width, height), COLORS["bg_dark"])
    draw = ImageDraw.Draw(img)

    # Add soft, abstract shapes (like light through a window)
    for _ in range(random.randint(2, 4)):
        # Random ellipse with soft edges
        x = random.randint(-50, width - 100)
        y = random.randint(-50, height - 100)
        w = random.randint(100, 300)
        h = random.randint(150, 400)

        # Muted color from palette
        colors = [
            (40, 35, 30),   # Deep brown
            (50, 45, 40),   # Warm gray
            (35, 30, 35),   # Cool shadow
            (60, 50, 45),   # Sepia hint
        ]
        color = random.choice(colors)

        # Draw with some transparency effect via multiple layers
        for i in range(20, 0, -2):
            expand = i * 3
            alpha_color = tuple(min(255, c + i * 2) for c in color)
            draw.ellipse(
                [x - expand, y - expand, x + w + expand, y + h + expand],
                fill=alpha_color
            )

    # Add a subtle light source (like window light)
    for _ in range(random.randint(1, 2)):
        x = random.randint(width // 4, 3 * width // 4)
        y = random.randint(0, height // 3)

        for i in range(30, 0, -1):
            brightness = 30 + i
            draw.ellipse(
                [x - i * 4, y - i * 3, x + i * 4, y + i * 5],
                fill=(brightness, brightness - 5, brightness - 10)
            )

    # Heavy blur for that soft-focus look
    img = img.filter(ImageFilter.GaussianBlur(radius=30))

    # Add film grain
    import numpy as np
    img_array = np.array(img)
    noise = np.random.normal(0, 8, img_array.shape).astype(np.int16)
    img_array = np.clip(img_array.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(img_array)

    # Slight vignette
    vignette = Image.new("L", (width, height), 255)
    vignette_draw = ImageDraw.Draw(vignette)
    for i in range(100):
        alpha = int(255 * (1 - i / 100) * 0.7)
        vignette_draw.ellipse(
            [-i * 3, -i * 2, width + i * 3, height + i * 2],
            fill=min(255, 100 + i * 2)
        )

    # Convert vignette to RGB and blend
    img = Image.blend(img, Image.new("RGB", (width, height), (5, 5, 5)), 0.2)

    return img


class VinylAmbientGUI:
    """Atmospheric GUI for the vinyl ambient generator."""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("vinyl ambient")
        self.root.configure(bg=COLORS["bg_dark"])
        self.root.resizable(False, False)

        # State
        self.is_generating = False
        self.current_preset = "ghostly"
        self.output_path: Optional[Path] = None
        self.custom_image_path: Optional[Path] = None

        self._setup_ui()
        self._load_or_generate_image()

    def _setup_ui(self):
        """Build the atmospheric interface."""
        # Main container with padding
        self.main_frame = tk.Frame(self.root, bg=COLORS["bg_dark"], padx=40, pady=30)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # Title - minimal, lowercase
        title = tk.Label(
            self.main_frame,
            text="vinyl ambient",
            font=("Helvetica Neue", 14, "normal"),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        title.pack(pady=(0, 20))

        # Photo frame (the main button)
        self.photo_frame = tk.Frame(
            self.main_frame,
            bg=COLORS["bg_medium"],
            highlightthickness=1,
            highlightbackground=COLORS["text_muted"],
        )
        self.photo_frame.pack()

        # Photo label (clickable)
        self.photo_label = tk.Label(
            self.photo_frame,
            bg=COLORS["bg_medium"],
            cursor="hand2",
        )
        self.photo_label.pack(padx=2, pady=2)
        self.photo_label.bind("<Button-1>", self._on_photo_click)
        self.photo_label.bind("<Enter>", self._on_hover_enter)
        self.photo_label.bind("<Leave>", self._on_hover_leave)

        # Instruction text (appears on hover)
        self.instruction_label = tk.Label(
            self.main_frame,
            text="click to generate",
            font=("Helvetica Neue", 10),
            fg=COLORS["bg_dark"],  # Hidden initially
            bg=COLORS["bg_dark"],
        )
        self.instruction_label.pack(pady=(15, 10))

        # Status label
        self.status_label = tk.Label(
            self.main_frame,
            text="",
            font=("Helvetica Neue", 9),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        self.status_label.pack(pady=(5, 15))

        # Controls frame - very subtle
        controls = tk.Frame(self.main_frame, bg=COLORS["bg_dark"])
        controls.pack(fill=tk.X, pady=(10, 0))

        # Preset selector
        preset_label = tk.Label(
            controls,
            text="mood",
            font=("Helvetica Neue", 9),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_dark"],
        )
        preset_label.pack(side=tk.LEFT)

        self.preset_var = tk.StringVar(value=self.current_preset)

        # Style the combobox
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "Dark.TCombobox",
            fieldbackground=COLORS["bg_medium"],
            background=COLORS["bg_medium"],
            foreground=COLORS["text_light"],
            arrowcolor=COLORS["text_muted"],
        )

        self.preset_combo = ttk.Combobox(
            controls,
            textvariable=self.preset_var,
            values=list_presets(),
            state="readonly",
            width=12,
            style="Dark.TCombobox",
        )
        self.preset_combo.pack(side=tk.LEFT, padx=(10, 20))
        self.preset_combo.bind("<<ComboboxSelected>>", self._on_preset_change)

        # Load custom image button
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
        """Load custom image or generate atmospheric placeholder."""
        if not HAS_PIL:
            # Fallback if PIL not available
            self.photo_label.configure(
                text="[ click to generate ]",
                fg=COLORS["text_muted"],
                font=("Helvetica Neue", 12),
                width=40,
                height=20,
            )
            return

        if self.custom_image_path and self.custom_image_path.exists():
            img = Image.open(self.custom_image_path)
            # Resize maintaining aspect ratio
            img.thumbnail((400, 500), Image.Resampling.LANCZOS)
            # Convert to grayscale for aesthetic
            img = img.convert("L").convert("RGB")
            # Add slight blur and grain
            img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
        else:
            img = generate_atmospheric_image(400, 500)

        self.photo_image = ImageTk.PhotoImage(img)
        self.photo_label.configure(image=self.photo_image)

    def _on_photo_click(self, event):
        """Handle click on the photograph - starts generation."""
        if self.is_generating:
            return

        # Ask where to save
        file_path = filedialog.asksaveasfilename(
            defaultextension=".wav",
            filetypes=[("WAV files", "*.wav")],
            initialfile="vinyl_ambient.wav",
            title="save as",
        )

        if not file_path:
            return

        self.output_path = Path(file_path)
        self._start_generation()

    def _on_hover_enter(self, event):
        """Show instruction on hover."""
        if not self.is_generating:
            self.instruction_label.configure(fg=COLORS["text_muted"])
            self.photo_frame.configure(highlightbackground=COLORS["accent_dim"])

    def _on_hover_leave(self, event):
        """Hide instruction on leave."""
        if not self.is_generating:
            self.instruction_label.configure(fg=COLORS["bg_dark"])
            self.photo_frame.configure(highlightbackground=COLORS["text_muted"])

    def _on_preset_change(self, event):
        """Handle preset selection change."""
        self.current_preset = self.preset_var.get()

    def _load_custom_image(self, event):
        """Load a custom image to use as the button."""
        file_path = filedialog.askopenfilename(
            filetypes=[
                ("Image files", "*.jpg *.jpeg *.png *.bmp *.tiff"),
                ("All files", "*.*"),
            ],
            title="choose image",
        )

        if file_path:
            self.custom_image_path = Path(file_path)
            self._load_or_generate_image()

    def _start_generation(self):
        """Start the generation process in a background thread."""
        self.is_generating = True
        self.instruction_label.configure(fg=COLORS["bg_dark"])
        self.photo_frame.configure(highlightbackground=COLORS["accent"])
        self.photo_label.configure(cursor="watch")
        self._update_status("fetching vinyl samples...")

        # Run generation in background thread
        thread = threading.Thread(target=self._generate_worker, daemon=True)
        thread.start()

    def _generate_worker(self):
        """Background worker for generation."""
        try:
            config = CompositionConfig(
                duration=180.0,
                num_layers=3,
                preset=self.current_preset,
            )

            self.root.after(0, lambda: self._update_status("processing layers..."))

            generate_ambient_piece(
                config=config,
                output_path=self.output_path,
                verbose=False,
            )

            self.root.after(0, lambda: self._on_generation_complete(True))

        except Exception as e:
            self.root.after(0, lambda: self._on_generation_complete(False, str(e)))

    def _on_generation_complete(self, success: bool, error: str = None):
        """Handle generation completion."""
        self.is_generating = False
        self.photo_label.configure(cursor="hand2")
        self.photo_frame.configure(highlightbackground=COLORS["text_muted"])

        if success:
            self._update_status(f"saved to {self.output_path.name}")
        else:
            self._update_status(f"error: {error}")

    def _update_status(self, text: str):
        """Update status label."""
        self.status_label.configure(text=text)

    def run(self):
        """Start the GUI event loop."""
        # Center window on screen
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f"+{x}+{y}")

        self.root.mainloop()


def main():
    """Launch the GUI."""
    if not HAS_PIL:
        print("Warning: Pillow not installed. Install with: pip install Pillow")
        print("The GUI will work but without the atmospheric image.")

    app = VinylAmbientGUI()
    app.run()


if __name__ == "__main__":
    main()
