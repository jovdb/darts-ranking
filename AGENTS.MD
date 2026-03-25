# Darts Ranking App

This will be a Solid Start application to start darts games with opponents and construct a ranking.

## Tech Stack

- Framework: Solid Start
- Language: TypeScript 6
- UI library: Base UI
- Styling: regular CSS imports
- Tooling:
  - ESLint
  - Prettier

## UI Parts

- Main part is player ranking with scores.
- Allow adding players. Players will only have a name.
- Selecting a player should show a detailed list of the games played by the player and it outcome.

## State

State will initially be stored in local storage, but it should use an abstraction so the storage location can later be replaced by a cloud-backed implementation.

Each played match will store the following properties:

- Date played (GMT)
- Winning player
- Losing player

We do not store ranking or difficulty information directly, so the scoring/ranking logic can change later

## Difficulty Levels

Each person will have a calculated difficulty level:

- Top 25% best players will have level 3 (L3).
  - L3 becomes available only if there are 5 different scores.
- Top 50% best players will have level 2 (L2).
  - L2 becomes available only if there are 3 different scores.
- The rest is level 1 (L1).

## Scoring Logic

The scoring system will be calculated from state using the following logic:

- Use only data from the last 3 months so we have a sliding ranking
- If someone wins a game, the player receive points equal to the opponent's difficulty level at that moment.
  This adds the reward when beating more advanced players
- If there was already a game with that opponent in the last 3 months, take the average of the scores with that opponent.
- Calculate in chronological order so difficulty levels can be built from the ranking at that time.
- Sum all played games per person to get the final score.
- Order players by score in a ranking list.
