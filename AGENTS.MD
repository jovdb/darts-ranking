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
  - A ranking graph section should show ranking points over time.
  - The ranking graph should show points vertically.
  - The ranking graph should show time horizontally, using one step per played match instead of linear wall-clock spacing.
  - The ranking graph should start with a `Match 0` step before the first played match.
  - The ranking graph should show one line per player.
  - Hovering the graph should show the match summary for that match step as `X beats Y: Zpts`.
  - Hovering anywhere inside a match column should show the same match-summary tooltip.
  - The ranking graph tooltip should also show the date the match was played.
  - Hovering a match column should subtly highlight that column on the graph.
  - A player grid matrix should show all player names horizontally as winners and vertically as losers.
  - Each player-grid cell should show the number of matches won for that winner/loser matchup.
  - The player grid should include a last row with total wins per winner and a last column with total losses per loser.
  - The first player-name column should use a reddish background and the first player-name row should use a greenish background.
  - Clicking a player-grid cell should open a popup with the recorded matches for that winner/loser pairing, using the same match row UI as the other match-history popups.
  - Clicking a same-player cell in the player grid should open a popup with all matches for that player.
  - Clicking a player name in the first player-grid column should open the same popup as that player's losses total.
  - Clicking a player name in the top player-grid row should open the same popup as that player's wins total.
  - Clicking a player-grid total in the last losses column should open a popup with all losses for that player.
  - Clicking a player-grid total in the last wins row should open a popup with all wins for that player.
  - Clicking the bottom-right player-grid total should open a popup with all matches, using the same UI as the match-count popup.
  - Clicking the match count should open a popup with a scrollable list of all played matches, ordered from recent to oldest.
  - The played matches list should show each player's rank and level at the time of that match.
  - Each played match item should show `X beat Y` with the date on the same row, plus a second row showing the winner, earned points, and total score at that time.
  - Clicking a player row in the ranking should open a popup with that player's matches, using the same match row UI as the all-matches popup.
  - Clicking the wins or losses text in a ranking row should open a popup filtered to that player's wins or losses.
  - The ranking list should show actual rank numbers, not simple index numbers.
  - Ranking numbers should be shown as large typographic numbers in each row, without a circle badge.
  - Players with the same score should share the same rank number.
  - Rank numbers should keep incrementing without gaps after ties (for example `1, 1, 2, 3`).
  - Players with the same score should be shown in a randomized order on each refresh.
- Allow adding players. Players will only have a name.
  - The add-player action should be triggered from a button placed below the ranking list.
  - The add-player flow should open as a popup.
- Selecting a player should show a detailed list of the games played by the player and its outcome.
- There should be a 'Start Match', it should:
  - be triggered from an `Add Match` button placed in the ranking header, next to the match count.
  - open as a popup.
  - ask to select multiple players using an add-player combobox with a plus button
  - show each selected player as a removable row with a delete button
  - allow selecting one selected player as winner by clicking that player row, with a visible winner indication
  - show each selectable player as `#rank Name (Lx)`.
  - show the points the winner will earn against each selected opponent.
  - show a message when the selected winner cannot play yet against one of the selected opponents because they already played each other in the last 4 weeks.
  - At confirm, add match information to state with one `winningPlayer` and a `losingPlayers` array.
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
The difficulty level is based on the ranking.
We check the ranking level of the player, players with the same number of points have the same ranking level.

- By default everyone gets a difficulty level of 1 (L1).
- If there are more than 4 different ranking levels/ points
  - players with a ranking level <= 50% of the number of different ranking levels will get level 2 (L2)
- If there are more than 5 different ranking levels/points
  - players with a ranking level <= 25% of the number of different ranking levels will get level 3 (L3)

Example 1:
| Rank | Player | Points | Level |
| --- | --- | --- | --- |
| #1 | Jo | 2pts | L1 |
| #2 | Dirk | 1pt | L1 |
| #3 | Erin | 0pts | L1 |

Example 2:
| Rank | Player | Points | Level |
| --- | --- | --- | --- |
| #1 | Jo | 5pts | L3 |
| #2 | Dirk | 4pts | L2 |
| #2 | Erin | 4pts | L2 |
| #3 | Jeroen | 3pts | L2 |
| #4 | Hannes | 2pts | L1 |
| #5 | Kelly | 0pts | L1 |

## Scoring Logic

The scoring system will be calculated from state using the following logic:

- Use only data from the last 3 months so we have a sliding ranking
- If someone wins a game, the player receives 1 point plus the difference between the opponent's difficulty level and the winner's difficulty level at that moment, with a minimum of 1 point.
  This adds rewards when beating more advanced players while keeping every win worth at least 1 point.
- A new game against the same opponent is only allowed after 4 weeks.
- Calculate in chronological order so difficulty levels can be built from the ranking at that time.
- Sum all played games per person to get the final score.
- Order players by score in a ranking list.

Keep this AGENTS.MD up-to-date with later requested prompts

## Hosting

This website is intended to be hosted on Github pages so it should be a static website.
When pushed to Github, it should build the static files and replace the latest version.
