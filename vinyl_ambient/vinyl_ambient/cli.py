"""
Command-line interface for Vinyl Ambient generator.
"""

from pathlib import Path

import click

from .effects import list_presets
from .generator import CompositionConfig, generate_ambient_piece


@click.group()
@click.version_option(version="0.1.0")
def main():
    """
    Vinyl Ambient - Generate haunting ambient music from archived 78rpm records.

    Fetches random samples from Internet Archive's public domain 78rpm collection,
    then processes them with reverb, delay, slowdown, and vinyl artifacts to
    create atmospheric soundscapes inspired by Philip Jeck.
    """
    pass


@main.command()
@click.option(
    "-o", "--output",
    type=click.Path(dir_okay=False, path_type=Path),
    default="vinyl_ambient_output.wav",
    help="Output file path (WAV format)",
)
@click.option(
    "-d", "--duration",
    type=float,
    default=180.0,
    help="Target duration in seconds (default: 180)",
)
@click.option(
    "-l", "--layers",
    type=int,
    default=3,
    help="Number of layers to mix (default: 3)",
)
@click.option(
    "-p", "--preset",
    type=click.Choice(list_presets()),
    default="default",
    help="Effect preset to use",
)
@click.option(
    "--min-year",
    type=int,
    default=1900,
    help="Minimum recording year (default: 1900)",
)
@click.option(
    "--max-year",
    type=int,
    default=1950,
    help="Maximum recording year (default: 1950)",
)
@click.option(
    "-q", "--quiet",
    is_flag=True,
    help="Suppress progress output",
)
def generate(
    output: Path,
    duration: float,
    layers: int,
    preset: str,
    min_year: int,
    max_year: int,
    quiet: bool,
):
    """
    Generate a new ambient piece from random vinyl samples.

    Fetches samples from Internet Archive's 78rpm collection and processes
    them into a layered ambient composition.

    Examples:

        # Basic generation with defaults
        vinyl-ambient generate

        # 5-minute piece with "deep" preset
        vinyl-ambient generate -d 300 -p deep -o deep_ambient.wav

        # More layers for denser texture
        vinyl-ambient generate -l 5 -p drone
    """
    config = CompositionConfig(
        duration=duration,
        num_layers=layers,
        preset=preset,
        year_range=(min_year, max_year),
    )

    try:
        generate_ambient_piece(
            config=config,
            output_path=output,
            verbose=not quiet,
        )
    except RuntimeError as e:
        raise click.ClickException(str(e))

    if not quiet:
        click.echo(f"\nOutput saved to: {output}")
        click.echo(f"Attribution file: {output.with_suffix('.txt')}")


@main.command()
def presets():
    """List available effect presets with descriptions."""
    preset_info = {
        "default": "Balanced ambient with moderate slowdown and reverb",
        "deep": "Two octaves down, massive reverb, very slow and subterranean",
        "ghostly": "Extra wow/flutter and vinyl noise for haunted atmosphere",
        "submerged": "Heavy filtering and reverb, like listening underwater",
        "nostalgic": "Lighter processing, more audible vinyl character",
        "drone": "Extreme slowdown for evolving drones and textures",
    }

    click.echo("Available presets:\n")
    for name in list_presets():
        desc = preset_info.get(name, "")
        click.echo(f"  {name:12} - {desc}")


@main.command()
@click.option(
    "-n", "--count",
    type=int,
    default=5,
    help="Number of records to show",
)
@click.option(
    "--min-year",
    type=int,
    default=1900,
    help="Minimum recording year",
)
@click.option(
    "--max-year",
    type=int,
    default=1950,
    help="Maximum recording year",
)
def browse(count: int, min_year: int, max_year: int):
    """
    Browse random records from the 78rpm archive.

    Shows what's available without downloading anything.
    """
    from .archive_fetcher import search_random_records

    click.echo(f"Searching for random 78rpm records ({min_year}-{max_year})...\n")

    records = search_random_records(count=count, year_range=(min_year, max_year))

    if not records:
        raise click.ClickException("Could not fetch records from Internet Archive")

    for i, record in enumerate(records, 1):
        title = record.get("title", "Unknown")
        creator = record.get("creator", "Unknown artist")
        year = record.get("year", "?")
        identifier = record.get("identifier", "")

        click.echo(f"{i}. {title}")
        click.echo(f"   Artist: {creator}")
        click.echo(f"   Year: {year}")
        click.echo(f"   URL: https://archive.org/details/{identifier}")
        click.echo()


if __name__ == "__main__":
    main()
