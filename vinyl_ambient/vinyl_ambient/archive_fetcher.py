"""
Fetch random audio chunks from Internet Archive's 78rpm collection.

The Internet Archive hosts thousands of public domain 78rpm recordings
at https://archive.org/details/78rpm
"""

import random
import tempfile
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

import requests
import numpy as np
import soundfile as sf


# Internet Archive API endpoints
IA_SEARCH_URL = "https://archive.org/advancedsearch.php"
IA_METADATA_URL = "https://archive.org/metadata"
IA_DOWNLOAD_URL = "https://archive.org/download"

# 78rpm collection identifier
COLLECTION_78RPM = "78rpm"

# Common audio formats in the archive
AUDIO_FORMATS = ["mp3", "ogg", "flac"]


@dataclass
class VinylSample:
    """A sample extracted from an archived 78rpm record."""

    audio: np.ndarray
    sample_rate: int
    source_identifier: str
    source_title: str
    source_file: str
    start_time: float
    duration: float


def search_random_records(count: int = 50, year_range: tuple[int, int] = (1900, 1950)) -> list[dict]:
    """
    Search for random 78rpm records from the Internet Archive.

    Args:
        count: Number of records to fetch metadata for
        year_range: Tuple of (min_year, max_year) to filter recordings

    Returns:
        List of record metadata dictionaries
    """
    min_year, max_year = year_range

    # Search query for 78rpm collection with audio files
    params = {
        "q": f"collection:{COLLECTION_78RPM} AND mediatype:audio AND year:[{min_year} TO {max_year}]",
        "fl[]": ["identifier", "title", "creator", "year", "description"],
        "sort[]": "random",  # Random sorting for variety
        "rows": count,
        "page": 1,
        "output": "json",
    }

    try:
        response = requests.get(IA_SEARCH_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get("response", {}).get("docs", [])
    except requests.RequestException as e:
        print(f"Error searching archive: {e}")
        return []


def get_audio_files(identifier: str) -> list[dict]:
    """
    Get list of audio files for a given archive item.

    Args:
        identifier: Internet Archive item identifier

    Returns:
        List of audio file metadata
    """
    try:
        response = requests.get(f"{IA_METADATA_URL}/{identifier}", timeout=30)
        response.raise_for_status()
        data = response.json()

        files = data.get("files", [])
        audio_files = [
            f for f in files
            if f.get("format", "").lower() in ["mp3", "ogg vorbis", "flac", "vbr mp3"]
            or any(f.get("name", "").lower().endswith(f".{ext}") for ext in AUDIO_FORMATS)
        ]

        return audio_files
    except requests.RequestException as e:
        print(f"Error fetching metadata for {identifier}: {e}")
        return []


def download_audio_file(identifier: str, filename: str, output_path: Optional[Path] = None) -> Optional[Path]:
    """
    Download an audio file from Internet Archive.

    Args:
        identifier: Archive item identifier
        filename: Name of the file to download
        output_path: Where to save the file (uses temp dir if None)

    Returns:
        Path to downloaded file, or None if failed
    """
    url = f"{IA_DOWNLOAD_URL}/{identifier}/{filename}"

    if output_path is None:
        suffix = Path(filename).suffix
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        output_path = Path(temp_file.name)
        temp_file.close()

    try:
        response = requests.get(url, timeout=120, stream=True)
        response.raise_for_status()

        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return output_path
    except requests.RequestException as e:
        print(f"Error downloading {filename}: {e}")
        return None


def extract_random_chunk(
    audio_path: Path,
    min_duration: float = 5.0,
    max_duration: float = 30.0,
) -> tuple[np.ndarray, int]:
    """
    Extract a random chunk from an audio file.

    Args:
        audio_path: Path to audio file
        min_duration: Minimum chunk duration in seconds
        max_duration: Maximum chunk duration in seconds

    Returns:
        Tuple of (audio_array, sample_rate)
    """
    # Read the full audio file
    audio, sample_rate = sf.read(audio_path, dtype="float32")

    # Convert to mono if stereo
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)

    total_duration = len(audio) / sample_rate

    # Determine chunk duration
    chunk_duration = random.uniform(min_duration, min(max_duration, total_duration * 0.8))
    chunk_samples = int(chunk_duration * sample_rate)

    # Pick random start point
    max_start = len(audio) - chunk_samples
    if max_start <= 0:
        # File is shorter than minimum, use whole thing
        return audio, sample_rate

    start_sample = random.randint(0, max_start)
    chunk = audio[start_sample:start_sample + chunk_samples]

    return chunk, sample_rate


def fetch_random_vinyl_sample(
    min_duration: float = 5.0,
    max_duration: float = 30.0,
    year_range: tuple[int, int] = (1900, 1950),
    max_attempts: int = 10,
) -> Optional[VinylSample]:
    """
    Fetch a random audio chunk from the 78rpm archive.

    This is the main entry point for getting vinyl samples.

    Args:
        min_duration: Minimum sample duration in seconds
        max_duration: Maximum sample duration in seconds
        year_range: Year range for recordings
        max_attempts: Number of attempts before giving up

    Returns:
        VinylSample object, or None if unable to fetch
    """
    for attempt in range(max_attempts):
        # Search for random records
        records = search_random_records(count=20, year_range=year_range)
        if not records:
            continue

        # Pick a random record
        record = random.choice(records)
        identifier = record.get("identifier")
        title = record.get("title", "Unknown")

        if not identifier:
            continue

        # Get audio files for this record
        audio_files = get_audio_files(identifier)
        if not audio_files:
            continue

        # Pick a random audio file (prefer mp3 for size)
        mp3_files = [f for f in audio_files if f.get("name", "").endswith(".mp3")]
        audio_file = random.choice(mp3_files if mp3_files else audio_files)
        filename = audio_file.get("name")

        if not filename:
            continue

        print(f"Fetching: {title} ({identifier}/{filename})")

        # Download the file
        audio_path = download_audio_file(identifier, filename)
        if audio_path is None:
            continue

        try:
            # Extract a random chunk
            audio, sample_rate = extract_random_chunk(
                audio_path,
                min_duration=min_duration,
                max_duration=max_duration,
            )

            start_time = 0.0  # We don't track exact position currently
            duration = len(audio) / sample_rate

            return VinylSample(
                audio=audio,
                sample_rate=sample_rate,
                source_identifier=identifier,
                source_title=title,
                source_file=filename,
                start_time=start_time,
                duration=duration,
            )
        except Exception as e:
            print(f"Error processing {filename}: {e}")
        finally:
            # Clean up temp file
            try:
                audio_path.unlink()
            except OSError:
                pass

    return None


def fetch_multiple_samples(
    count: int = 3,
    min_duration: float = 5.0,
    max_duration: float = 30.0,
    year_range: tuple[int, int] = (1900, 1950),
) -> list[VinylSample]:
    """
    Fetch multiple random vinyl samples for layering.

    Args:
        count: Number of samples to fetch
        min_duration: Minimum sample duration
        max_duration: Maximum sample duration
        year_range: Year range for recordings

    Returns:
        List of VinylSample objects
    """
    samples = []

    for i in range(count):
        print(f"Fetching sample {i + 1}/{count}...")
        sample = fetch_random_vinyl_sample(
            min_duration=min_duration,
            max_duration=max_duration,
            year_range=year_range,
        )
        if sample:
            samples.append(sample)

    return samples
