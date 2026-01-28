# Vinyl Ambient

Generate haunting ambient music from archived 78rpm vinyl records.

Inspired by **Philip Jeck**'s layered, decayed vinyl soundscapes, this tool fetches random samples from the Internet Archive's public domain 78rpm collection and processes them with:

- **Slowdown** - Pitch-shifts samples down for deep, subterranean tones
- **Reverb** - Cavernous spaces and long tails
- **Delay** - Tape-style echoes
- **Wow & Flutter** - Turntable wobble and drift
- **Vinyl Noise** - Surface hiss and crackle
- **Saturation** - Warm tape-style coloring

## Installation

```bash
cd vinyl_ambient
pip install -e .
```

## Usage

### Generate ambient music

```bash
# Basic generation (3 layers, 3 minutes)
vinyl-ambient generate

# Custom duration and output
vinyl-ambient generate -d 300 -o my_ambient.wav

# Use a preset
vinyl-ambient generate -p deep
vinyl-ambient generate -p ghostly
vinyl-ambient generate -p drone

# More layers for denser texture
vinyl-ambient generate -l 5

# Specify year range for source recordings
vinyl-ambient generate --min-year 1920 --max-year 1935
```

### List presets

```bash
vinyl-ambient presets
```

Available presets:
- **default** - Balanced ambient with moderate slowdown and reverb
- **deep** - Two octaves down, massive reverb, very slow and subterranean
- **ghostly** - Extra wow/flutter and vinyl noise for haunted atmosphere
- **submerged** - Heavy filtering and reverb, like listening underwater
- **nostalgic** - Lighter processing, more audible vinyl character
- **drone** - Extreme slowdown for evolving drones and textures

### Browse the archive

```bash
vinyl-ambient browse -n 10
```

## Python API

```python
from vinyl_ambient.generator import generate_ambient_piece, CompositionConfig
from vinyl_ambient.effects import create_effect_preset

# Quick generation
from vinyl_ambient.generator import quick_generate
quick_generate("output.wav", preset="ghostly", num_layers=4)

# Custom configuration
config = CompositionConfig(
    duration=300.0,         # 5 minutes
    num_layers=4,
    preset="deep",
    year_range=(1910, 1940),
)

audio, sample_rate, attributions = generate_ambient_piece(
    config=config,
    output_path="deep_ambient.wav",
)
```

## How it works

1. **Fetch** - Searches Internet Archive's 78rpm collection for random public domain recordings
2. **Extract** - Downloads and extracts random chunks from each recording
3. **Process** - Applies the effects chain (slowdown, reverb, delay, vinyl artifacts)
4. **Layer** - Mixes multiple processed samples with staggered timing and stereo positioning
5. **Output** - Saves the final composition with source attributions

## Sources

All audio is sourced from the [Internet Archive's 78rpm collection](https://archive.org/details/78rpm), which contains thousands of public domain recordings from the early 20th century.

Each generated piece includes an attribution file listing the source recordings used.

## License

MIT
