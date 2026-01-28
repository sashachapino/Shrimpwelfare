"""
Audio effects processor for creating haunting vinyl ambient textures.

Implements the core effects that define the Philip Jeck aesthetic:
- Slowdown (pitch shift + time stretch)
- Reverb (large cavernous spaces)
- Delay (tape-style echoes)
- Wow and flutter (turntable imperfections)
- Tape saturation
- Vinyl noise and crackle
"""

from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy import signal
from scipy.ndimage import uniform_filter1d

from pedalboard import (
    Pedalboard,
    Reverb,
    Delay,
    Chorus,
    LowpassFilter,
    HighpassFilter,
    Compressor,
    Gain,
    Limiter,
)


@dataclass
class EffectSettings:
    """Settings for the vinyl ambient effects chain."""

    # Slowdown factor (0.5 = half speed/octave down, 0.25 = 2 octaves down)
    slowdown_factor: float = 0.5

    # Reverb settings
    reverb_room_size: float = 0.85
    reverb_damping: float = 0.7
    reverb_wet_level: float = 0.6
    reverb_dry_level: float = 0.4

    # Delay settings
    delay_seconds: float = 0.4
    delay_feedback: float = 0.5
    delay_mix: float = 0.3

    # Wow and flutter (turntable wobble)
    wow_depth: float = 0.002  # Pitch variation depth
    wow_rate: float = 0.5  # Hz - slow wobble
    flutter_depth: float = 0.001
    flutter_rate: float = 6.0  # Hz - faster wobble

    # Filtering
    lowpass_freq: float = 4000.0  # Cut highs for muffled sound
    highpass_freq: float = 60.0  # Remove rumble

    # Vinyl noise
    noise_level: float = 0.02
    crackle_density: float = 0.001

    # Saturation
    saturation_drive: float = 1.5

    # Output
    output_gain_db: float = -3.0


def slowdown(audio: np.ndarray, sample_rate: int, factor: float) -> tuple[np.ndarray, int]:
    """
    Slow down audio by resampling (pitch shifts down).

    This creates the classic slowed-down vinyl effect.

    Args:
        audio: Input audio array
        sample_rate: Original sample rate
        factor: Slowdown factor (0.5 = half speed, octave down)

    Returns:
        Tuple of (processed audio, new effective sample rate for playback)
    """
    if factor >= 1.0:
        return audio, sample_rate

    # Resample to slow down (this also pitches down)
    num_samples = int(len(audio) / factor)
    slowed = signal.resample(audio, num_samples)

    return slowed, sample_rate


def apply_wow_flutter(
    audio: np.ndarray,
    sample_rate: int,
    wow_depth: float = 0.002,
    wow_rate: float = 0.5,
    flutter_depth: float = 0.001,
    flutter_rate: float = 6.0,
) -> np.ndarray:
    """
    Apply wow and flutter - the subtle pitch variations of old turntables.

    Wow: slow, gentle pitch drift
    Flutter: faster, smaller pitch variations

    Args:
        audio: Input audio
        sample_rate: Sample rate
        wow_depth: Depth of slow pitch variation
        wow_rate: Rate of slow variation in Hz
        flutter_depth: Depth of fast pitch variation
        flutter_rate: Rate of fast variation in Hz

    Returns:
        Processed audio with wow and flutter
    """
    num_samples = len(audio)
    t = np.arange(num_samples) / sample_rate

    # Create modulation signal combining wow and flutter
    wow = wow_depth * np.sin(2 * np.pi * wow_rate * t)
    flutter = flutter_depth * np.sin(2 * np.pi * flutter_rate * t + np.random.uniform(0, 2 * np.pi))

    # Add some randomness to make it more organic
    noise = np.random.normal(0, flutter_depth * 0.3, num_samples)
    noise = uniform_filter1d(noise, size=int(sample_rate * 0.01))  # Smooth the noise

    modulation = 1.0 + wow + flutter + noise

    # Apply pitch modulation via variable delay/interpolation
    indices = np.arange(num_samples)
    modulated_indices = np.cumsum(modulation)
    modulated_indices = modulated_indices * (num_samples - 1) / modulated_indices[-1]

    # Interpolate to new positions
    output = np.interp(indices, modulated_indices, audio)

    return output


def generate_vinyl_noise(
    num_samples: int,
    sample_rate: int,
    noise_level: float = 0.02,
    crackle_density: float = 0.001,
) -> np.ndarray:
    """
    Generate vinyl surface noise and crackle.

    Args:
        num_samples: Number of samples to generate
        sample_rate: Sample rate
        noise_level: Level of continuous hiss
        crackle_density: Probability of crackle per sample

    Returns:
        Noise array to mix with audio
    """
    # Base hiss (filtered white noise)
    hiss = np.random.normal(0, noise_level, num_samples)

    # Apply bandpass to make it sound like vinyl hiss
    nyquist = sample_rate / 2
    low = 200 / nyquist
    high = 8000 / nyquist
    b, a = signal.butter(2, [low, high], btype="band")
    hiss = signal.filtfilt(b, a, hiss)

    # Crackles and pops
    crackle_mask = np.random.random(num_samples) < crackle_density
    crackles = np.zeros(num_samples)
    crackles[crackle_mask] = np.random.choice([-1, 1], size=np.sum(crackle_mask)) * np.random.uniform(
        0.1, 0.4, size=np.sum(crackle_mask)
    )

    # Shape crackles with quick decay
    decay_samples = int(sample_rate * 0.002)  # 2ms decay
    if decay_samples > 0:
        decay_kernel = np.exp(-np.arange(decay_samples) / (decay_samples / 4))
        crackles = np.convolve(crackles, decay_kernel, mode="same")

    return hiss + crackles * noise_level * 3


def soft_saturate(audio: np.ndarray, drive: float = 1.5) -> np.ndarray:
    """
    Apply soft saturation/tape warmth.

    Args:
        audio: Input audio
        drive: Saturation amount (1.0 = no saturation)

    Returns:
        Saturated audio
    """
    # Drive the signal
    driven = audio * drive

    # Soft clip using tanh
    saturated = np.tanh(driven)

    # Compensate for level increase
    saturated = saturated / drive

    return saturated


def apply_fade_in_out(audio: np.ndarray, sample_rate: int, fade_time: float = 2.0) -> np.ndarray:
    """
    Apply smooth fade in and fade out.

    Args:
        audio: Input audio
        sample_rate: Sample rate
        fade_time: Fade duration in seconds

    Returns:
        Audio with fades applied
    """
    fade_samples = int(fade_time * sample_rate)
    fade_samples = min(fade_samples, len(audio) // 4)  # Don't fade more than 1/4 of audio

    if fade_samples < 100:
        return audio

    output = audio.copy()

    # Fade in (raised cosine for smooth curve)
    fade_in = 0.5 * (1 - np.cos(np.linspace(0, np.pi, fade_samples)))
    output[:fade_samples] *= fade_in

    # Fade out
    fade_out = 0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_samples)))
    output[-fade_samples:] *= fade_out

    return output


def process_sample(
    audio: np.ndarray,
    sample_rate: int,
    settings: Optional[EffectSettings] = None,
) -> np.ndarray:
    """
    Apply the full effects chain to create haunting vinyl ambient.

    Args:
        audio: Input audio array (mono, float32)
        sample_rate: Sample rate
        settings: Effect settings (uses defaults if None)

    Returns:
        Processed audio array
    """
    if settings is None:
        settings = EffectSettings()

    # 1. Slowdown (pitch shift down)
    audio, _ = slowdown(audio, sample_rate, settings.slowdown_factor)

    # 2. Apply wow and flutter
    audio = apply_wow_flutter(
        audio,
        sample_rate,
        wow_depth=settings.wow_depth,
        wow_rate=settings.wow_rate,
        flutter_depth=settings.flutter_depth,
        flutter_rate=settings.flutter_rate,
    )

    # 3. Soft saturation for warmth
    audio = soft_saturate(audio, settings.saturation_drive)

    # 4. Build pedalboard effects chain
    board = Pedalboard([
        # Filter to shape the tone
        HighpassFilter(cutoff_frequency_hz=settings.highpass_freq),
        LowpassFilter(cutoff_frequency_hz=settings.lowpass_freq),
        # Subtle compression to even out dynamics
        Compressor(threshold_db=-20, ratio=3, attack_ms=50, release_ms=200),
        # Delay for echoes
        Delay(
            delay_seconds=settings.delay_seconds,
            feedback=settings.delay_feedback,
            mix=settings.delay_mix,
        ),
        # Big reverb for space
        Reverb(
            room_size=settings.reverb_room_size,
            damping=settings.reverb_damping,
            wet_level=settings.reverb_wet_level,
            dry_level=settings.reverb_dry_level,
        ),
        # Final gain and limiting
        Gain(gain_db=settings.output_gain_db),
        Limiter(threshold_db=-1.0),
    ])

    # Apply pedalboard (needs 2D array)
    audio_2d = audio.reshape(1, -1)
    processed = board(audio_2d, sample_rate)
    audio = processed.flatten()

    # 5. Add vinyl noise
    noise = generate_vinyl_noise(
        len(audio),
        sample_rate,
        noise_level=settings.noise_level,
        crackle_density=settings.crackle_density,
    )
    audio = audio + noise

    # 6. Apply fades
    audio = apply_fade_in_out(audio, sample_rate, fade_time=3.0)

    # Final normalization
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.9

    return audio


def create_effect_preset(name: str) -> EffectSettings:
    """
    Get a named effect preset.

    Args:
        name: Preset name

    Returns:
        EffectSettings for the preset
    """
    presets = {
        "default": EffectSettings(),
        "deep": EffectSettings(
            slowdown_factor=0.25,  # 2 octaves down
            reverb_room_size=0.95,
            reverb_wet_level=0.8,
            delay_seconds=0.6,
            delay_feedback=0.6,
            lowpass_freq=2000.0,
        ),
        "ghostly": EffectSettings(
            slowdown_factor=0.4,
            reverb_room_size=0.9,
            reverb_wet_level=0.7,
            wow_depth=0.004,
            flutter_depth=0.002,
            noise_level=0.03,
            crackle_density=0.002,
        ),
        "submerged": EffectSettings(
            slowdown_factor=0.3,
            reverb_room_size=0.98,
            reverb_damping=0.9,
            reverb_wet_level=0.85,
            lowpass_freq=1500.0,
            delay_seconds=0.8,
            delay_feedback=0.7,
        ),
        "nostalgic": EffectSettings(
            slowdown_factor=0.6,
            reverb_room_size=0.7,
            reverb_wet_level=0.5,
            noise_level=0.04,
            crackle_density=0.003,
            lowpass_freq=5000.0,
        ),
        "drone": EffectSettings(
            slowdown_factor=0.15,  # Very slow
            reverb_room_size=0.99,
            reverb_wet_level=0.9,
            reverb_damping=0.5,
            delay_seconds=1.0,
            delay_feedback=0.75,
            lowpass_freq=1000.0,
        ),
    }

    return presets.get(name, presets["default"])


def list_presets() -> list[str]:
    """Get list of available preset names."""
    return ["default", "deep", "ghostly", "submerged", "nostalgic", "drone"]
