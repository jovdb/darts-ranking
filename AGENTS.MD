# Darts Ranking App

This will be a Solid Start application to start darts games with opponents and construct a ranking.

## Tech Stack

- Framework: Solid Start
- Language: TypeScript 6
- Styling: regular CSS import per component
- Tooling:
  - ESLint
  - Prettier

## UI Parts

- Main part is player ranking with scores.
  - The ranking list should show actual rank numbers, not simple index numbers.
  - Ranking numbers should be shown as large typographic numbers in each row, without a circle badge.
  - Players with the same score should share the same rank number.
  - Rank numbers should keep incrementing without gaps after ties (for example `1, 1, 2, 3`).
  - Players with the same score should be shown in a randomized order on each refresh.
- Allow adding players. Players will only have a name.
  - The add-player action should be triggered from a button placed below the ranking list.
  - The add-player flow should open as a popup.
- Selecting a player should show a detailed list of the games played by the player and it outcome.
- There should be a 'Start Match', it should:
  - be triggered from an `Add Match` button placed below the ranking list.
  - open as a popup.
  - ask to select the 2 players
  - show each selectable player as `#rank Name (Lx)`.
  - show the points the winner will earn, for example `Jo (+1pt)`.
  - show a message when the selected players cannot play yet because they already played each other in the last 4 weeks.
  - allow to select the winner
  - At confirmed add match information to the state.
- You can add animations to make it more attractive (you can use View Transition API)

## State

State will initially be stored in local storage, but it should use an abstraction so the storage location can later be replaced by a cloud-backed implementation.

Each played match will store the following properties:

- Date played (GMT)
- Winning player
- Losing player

We do not store ranking or difficulty information directly, so the scoring/ranking logic can change later

## Difficulty Levels

Each person will have a calculated difficulty level:

- Top 25% best players in the ranking will have level 3 (L3).
  - L3 becomes available only if there are at least 10 games played.
- Top 50% best players in the ranking will have level 2 (L2).
  - L2 becomes available only if there are at least 5 games.
- The rest on the ranking has level 1 (L1).

## Scoring Logic

The scoring system will be calculated from state using the following logic:

- Use only data from the last 3 months so we have a sliding ranking
- If someone wins a game, the player receive points equal to the opponent's difficulty level at that moment.
  This adds rewards when beating more advanced players
- A new game against the same opponent is only allowed after 4 weeks.
- Calculate in chronological order so difficulty levels can be built from the ranking at that time.
- Sum all played games per person to get the final score.
- Order players by score in a ranking list.

Keep this AGENTS.MD up-to-date with later requested prompts

## Hosting

This website is intended to be hosted on Github pages so it should be a static website.
When pushed to Github, it should build the static files and replace the latest version.
