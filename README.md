[https://adorable-meerkat-ecf728.netlify.app/](https://adorable-meerkat-ecf728.netlify.app/)

A web-based Formula 1 and motorsport telemetry visualizer built with React, TypeScript, and HTML5 Canvas. The application ingests real timing and car dynamics data from the OpenF1 API to compare lap performance between drivers across speed, pedal inputs, and spatial circuit positions.

## Features

- **Multi-Channel Canvas Plotter:** Synchronized speed, throttle, brake, and live time-delta ($\Delta t$) traces rendered on HTML5 Canvas over spatial track distance.
- **Dynamic 2D GPS Track Map:** Automatically generates SVG circuit outlines from authentic driver GPS coordinates, complete with interactive scrub-to-seek snapping and live car beacons.
- **G-G Friction Circle:** Real-time polar plot of lateral vs. longitudinal forces with a decaying point trail to visualize trail-braking efficiency.
- **OpenF1 Live Ingestion:** Queries the OpenF1 REST API for meetings, sessions, drivers, fastest laps, and high-frequency telemetry across recent F1 seasons.
- **Offline Benchmark Mode:** Bundled reference dataset allowing instant evaluation without API rate limits or network dependencies.
- **File Importer:** Client-side parser for external telemetry datasets formatted as JSON or CSV.

## Tech Stack

- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** SCSS Modules
- **Rendering:** HTML5 Canvas & SVG DOM API
- **Data Source:** [OpenF1 API](https://openf1.org)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
