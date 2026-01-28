"""
Main ambient generator - layers processed vinyl samples into compositions.

Creates haunting soundscapes by mixing multiple processed 78rpm samples
with varying start times, volumes, and effect settings.
"""

import random
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf

from .archive_fetcher import VinylSample, fetch_multiple_samples, fetch_random_vinyl_sample
from .effects import EffectSettings, process_sample, create_effect_preset, list_presets


@dataclass
class LayerConfig:
    """Configuration for a single layer in the composition."""

    sample: VinylSample
    effect_settings: EffectSettings
    start_time: float  # When this layer starts (seconds from beginning)
    volume: float  # 0.0 to 1.0
    pan: float  # -1.0 (left) to 1.0 (right), 0.0 = center


@dataclass
class CompositionConfig:
    """Configuration for the full composition."""

    duration: float = 180.0  # Target duration in seconds
    num_layers: int = 3
    sample_rate: int = 44100
    preset: str = "default"
    year_range: tuple[int, int] = (1900, 1950)
    min_sample_duration: float = 10.0
    max_sample_duration: float = 45.0


def create_stereo_from_mono(mono: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """
    Convert mono to stereo with panning.

    Args:
        mono: Mono audio array
        pan: Pan position (-1.0 = left, 0.0 = center, 1.0 = right)

    Returns:
        Stereo array (samples, 2)
    """
    # Convert pan (-1 to 1) to left/right gains
    # Using constant power panning
    angle = (pan + 1) * np.pi / 4  # 0 to pi/2
    left_gain = np.cos(angle)
    right_gain = np.sin(angle)

    stereo = np.zeros((len(mono), 2))
    stereo[:, 0] = mono * left_gain
    stereo[:, 1] = mono * right_gain

    return stereo


def mix_layers(
    layers: list[tuple[np.ndarray, float, float, float]],
    total_duration: float,
    sample_rate: int,
) -> np.ndarray:
    """
    Mix multiple audio layers into a stereo composition.

    Args:
        layers: List of (audio, start_time, volume, pan) tuples
        total_duration: Total output duration in seconds
        sample_rate: Sample rate

    Returns:
        Mixed stereo audio array
    """
    total_samples = int(total_duration * sample_rate)
    output = np.zeros((total_samples, 2))

    for audio, start_time, volume, pan in layers:
        start_sample = int(start_time * sample_rate)

        # Convert to stereo with panning
        stereo = create_stereo_from_mono(audio, pan)

        # Apply volume
        stereo *= volume

        # Calculate how much of this layer fits
        end_sample = min(start_sample + len(stereo), total_samples)
        layer_length = end_sample - start_sample

        if layer_length > 0 and start_sample >= 0:
            output[start_sample:end_sample] += stereo[:layer_length]

    return output


def generate_ambient_piece(
    config: Optional[CompositionConfig] = None,
    output_path: Optional[Path] = None,
    samples: Optional[list[VinylSample]] = None,
    verbose: bool = True,
) -> tuple[np.ndarray, int, list[str]]:
    """
    Generate a complete ambient piece from vinyl samples.

    Args:
        config: Composition configuration
        output_path: Where to save the output (optional)
        samples: Pre-fetched samples (will fetch if None)
        verbose: Print progress

    Returns:
        Tuple of (audio array, sample rate, list of source attributions)
    """
    if config is None:
        config = CompositionConfig()

    # Get effect preset
    base_settings = create_effect_preset(config.preset)

    # Fetch samples if not provided
    if samples is None:
        if verbose:
            print(f"Fetching {config.num_layers} vinyl samples from Internet Archive...")
        samples = fetch_multiple_samples(
            count=config.num_layers,
            min_duration=config.min_sample_duration,
            max_duration=config.max_sample_duration,
            year_range=config.year_range,
        )

    if not samples:
        raise RuntimeError("Could not fetch any vinyl samples")

    if verbose:
        print(f"Processing {len(samples)} samples...")

    # Process each sample and prepare layers
    layers = []
    attributions = []

    for i, sample in enumerate(samples):
        if verbose:
            print(f"  Processing layer {i + 1}: {sample.source_title}")

        # Vary the effect settings slightly for each layer
        layer_settings = EffectSettings(
            slowdown_factor=base_settings.slowdown_factor * random.uniform(0.8, 1.2),
            reverb_room_size=base_settings.reverb_room_size,
            reverb_damping=base_settings.reverb_damping,
            reverb_wet_level=base_settings.reverb_wet_level * random.uniform(0.9, 1.1),
            reverb_dry_level=base_settings.reverb_dry_level,
            delay_seconds=base_settings.delay_seconds * random.uniform(0.8, 1.3),
            delay_feedback=base_settings.delay_feedback,
            delay_mix=base_settings.delay_mix * random.uniform(0.8, 1.2),
            wow_depth=base_settings.wow_depth * random.uniform(0.5, 1.5),
            wow_rate=base_settings.wow_rate * random.uniform(0.7, 1.3),
            flutter_depth=base_settings.flutter_depth,
            flutter_rate=base_settings.flutter_rate,
            lowpass_freq=base_settings.lowpass_freq * random.uniform(0.8, 1.2),
            highpass_freq=base_settings.highpass_freq,
            noise_level=base_settings.noise_level * random.uniform(0.5, 1.5),
            crackle_density=base_settings.crackle_density,
            saturation_drive=base_settings.saturation_drive,
            output_gain_db=base_settings.output_gain_db,
        )

        # Process the sample
        processed = process_sample(
            sample.audio,
            sample.sample_rate,
            layer_settings,
        )

        # Resample to target sample rate if needed
        if sample.sample_rate != config.sample_rate:
            from scipy import signal
            num_samples = int(len(processed) * config.sample_rate / sample.sample_rate)
            processed = signal.resample(processed, num_samples)

        # Determine layer timing
        # Stagger start times, first layer starts at 0
        max_start = max(0, config.duration - len(processed) / config.sample_rate - 10)
        start_time = (i / max(1, len(samples) - 1)) * max_start * 0.5 if i > 0 else 0

        # Random volume and pan
        volume = random.uniform(0.6, 1.0)
        pan = random.uniform(-0.6, 0.6)

        layers.append((processed, start_time, volume, pan))

        # Track attribution
        attributions.append(
            f"{sample.source_title} (archive.org/details/{sample.source_identifier})"
        )

    if verbose:
        print("Mixing layers...")

    # Calculate total duration based on longest layer
    actual_duration = 0
    for audio, start_time, _, _ in layers:
        layer_end = start_time + len(audio) / config.sample_rate
        actual_duration = max(actual_duration, layer_end)

    # Use the longer of target or actual duration
    total_duration = max(config.duration, actual_duration)

    # Mix all layers
    mixed = mix_layers(layers, total_duration, config.sample_rate)

    # Final master processing
    # Normalize
    peak = np.max(np.abs(mixed))
    if peak > 0:
        mixed = mixed / peak * 0.85

    # Apply final fade out
    fade_samples = int(5.0 * config.sample_rate)
    if fade_samples < len(mixed):
        fade = np.linspace(1.0, 0.0, fade_samples)
        mixed[-fade_samples:, 0] *= fade
        mixed[-fade_samples:, 1] *= fade

    # Save if output path provided
    if output_path:
        if verbose:
            print(f"Saving to {output_path}...")
        sf.write(output_path, mixed, config.sample_rate)

        # Save attribution file
        attr_path = output_path.with_suffix(".txt")
        with open(attr_path, "w") as f:
            f.write("Vinyl Ambient - Source Attributions\n")
            f.write("=" * 40 + "\n\n")
            f.write("This piece was generated using samples from the\n")
            f.write("Internet Archive's 78rpm collection (archive.org/details/78rpm)\n\n")
            f.write("Sources:\n")
            for attr in attributions:
                f.write(f"  - {attr}\n")

        if verbose:
            print(f"Attribution saved to {attr_path}")

    if verbose:
        duration_str = f"{int(total_duration // 60)}:{int(total_duration % 60):02d}"
        print(f"Done! Generated {duration_str} of ambient audio.")

    return mixed, config.sample_rate, attributions


def quick_generate(
    output_path: str = "vinyl_ambient_output.wav",
    preset: str = "default",
    num_layers: int = 3,
    duration: float = 180.0,
) -> Path:
    """
    Quick generation with sensible defaults.

    Args:
        output_path: Where to save the output
        preset: Effect preset name
        num_layers: Number of layers to mix
        duration: Target duration in seconds

    Returns:
        Path to the generated file
    """
    path = Path(output_path)

    config = CompositionConfig(
        duration=duration,
        num_layers=num_layers,
        preset=preset,
    )

    generate_ambient_piece(config=config, output_path=path)

    return path
