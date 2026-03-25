# Darts Ranking System

Welcome to the Smartphoto Darts Ranking App! \
This is a fun way to keep track of darts matches among players. It calculates rankings based on who wins and how challenging the opponents are.
Let's break it down simply.

## How It Works

### Starting Out

- Every player begins with 0 points.
- As you play matches, winners earn points based on the match.

### Playing Matches

- When someone wins a match, they get points. The number of points depends on the difficulty levels of the players involved.
- Points are calculated as: **at least 1 point, plus the difference between the loser's level and the winner's level**.
- For example, if a Level 1 player beats a Level 3 player, they get 1 + (3 - 1) = 3 points.
- If a Level 2 player beats another Level 2 player, they get 1 + (2 - 2) = 1 point.

### Difficulty Levels

Players get levels based on their ranking position:

- **Level 1 (L1)**: The default level for everyone.
- **Level 2 (L2)**: For players in the top half of the rankings \
   Only active when there are more than 3 different ranking positions.
- **Level 3 (L3)**: For players in the top quarter of the rankings \
   Only active when there are more than 4 different ranking positions.

### Time Matters

- Only matches from the last 3 months count toward rankings. Older matches are forgotten to keep things fresh.
- You can't play the same opponent again within 4 weeks to encourage variety.

## Getting Started

To use the app:

1. Goto: https://jovdb.github.io/darts-ranking
2. Add players.
3. Record matches by selecting two players and picking the winner.
4. View the rankings and match history.

Enjoy your darts games!
