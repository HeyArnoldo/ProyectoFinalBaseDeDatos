# Restaurant Web Experience Specification

## Purpose

Define presentation-ready public and operator web behavior.

## Requirements

### Requirement: Public Catalog and Checkout

At mobile and desktop widths, the web MUST offer a neutral-Spanish category-filtered catalog. Cards MUST show name, description, price, availability, and product visual/fallback. The Mongo seed MUST contain about 12 products across categories, including inactive products; active products MUST appear and inactive ones MUST not. Cart MUST change/remove quantities; checkout MUST expose accessible labels, errors, loading, and server-authoritative totals; confirmation MUST show returned UUID and pending/processed projection status or lag. Empty, offline, and error states MUST be explicit.

#### Scenario: Desktop checkout

- GIVEN a desktop active seeded catalog
- WHEN a guest filters, changes/removes cart items, and checks out
- THEN cards, authoritative total, UUID, and projection state appear

#### Scenario: Mobile unavailable catalog

- GIVEN mobile, inactive, missing-visual, and unavailable data
- WHEN the catalog opens
- THEN responsive fallback hides inactive and labels empty/offline/error states

### Requirement: Operator Experience and Accessibility

Operator login and authenticated use of a responsive board for valid transitions, projection status/replay, and projection reads MUST be available. The web MUST support keyboard navigation, visible focus, semantic landmarks, WCAG AA contrast, reduced motion, explicit unauthorized state, and usability within 96 MiB.

#### Scenario: Accessible operator board

- GIVEN a 96 MiB runtime and signed-in keyboard operator
- WHEN the board opens at narrow or wide width
- THEN valid transition/status/read work with landmarks, focus, contrast, and reduced motion

#### Scenario: Unauthorized operator view

- GIVEN an invalid or expired session
- WHEN protected board, status, or read opens
- THEN an unauthorized error appears without data disclosure or transition
