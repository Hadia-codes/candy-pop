# 🍬 Candy Pop (Candy Crush Clone)

A cute, pixel-art match-three game that runs in the browser. Built with plain HTML, CSS and JavaScript. No libraries, no build step.

---

## 🎯 Project Overview

This project recreates the core mechanics of Candy Crush as a small web game. Every candy is drawn pixel by pixel in code, so there are no image files to load. It works on desktop and phone, and it can be installed as an app.

---

## 🧩 Features

- **Grid-Based Gameplay**: 8 x 8 board with six pixel candies, each with its own little face.
- **Candy Matching**: Lines of three or more matching candies pop and disappear.
- **Score Tracking**: 10 points per candy, multiplied for every chain reaction (combo).
- **User Interaction**: Tap two neighbouring candies to swap, or drag a candy.
- **Dynamic Board**: Candies fall and new ones drop in after every match.
- **Levels**: Reach the goal score before your 20 moves run out. Each level has a higher goal.
- **Hints and Shuffle**: Idle for a few seconds and a possible move wiggles. If no moves are left, the board shuffles itself.
- **Chip Sounds**: Tiny beeps for swaps and matches, with a mute button.
- **Installable**: Works offline and can be added to a phone or desktop as an app.

---

## 🛠️ Technologies Used

- **Language**: HTML, CSS, JavaScript (canvas)
- **IDE**: VS Code
- **Version Control**: Git

---

## 🚀 Getting Started

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Hadia-codes/candy-pop.git
   ```
2. **Navigate to the Project Directory**:
   ```bash
   cd candy-pop
   ```
3. **Run the Game**: pick one.
   - Easiest: double-click `index.html`.
   - Best: in VS Code, install the "Live Server" extension, right-click `index.html`, then "Open with Live Server".
   - Or from a terminal:
     ```bash
     npx serve .
     ```

---

## 🌍 Hosting (GitHub Pages)

```bash
git init
git add .
git commit -m "Candy Pop"
git branch -M main
git remote add origin https://github.com/Hadia-codes/candy-pop.git
git push -u origin main
```

Then on GitHub: **Settings > Pages > Source: Deploy from a branch > main / (root) > Save**.
After a minute your game is live at `https://hadia-codes.github.io/candy-pop/`.

To install it as an app, open that link in Chrome or Edge and click the install icon in the address bar. On a phone, use the browser menu and choose "Add to Home screen".

---

## 📸 Screenshots

Play a round, take screenshots, and save them in the `screenshots` folder.

![Game Start](screenshots/start.png)
*Initial game board.*

![After Match](screenshots/match.png)
*Board after a successful match.*

---

## 📝 Future Enhancements

- **Special Candies**: Striped, wrapped, and color bomb candies.
- **More Levels**: Different goals, such as clearing a certain colour.
- **Leaderboard**: Save high scores online.

---

## 🤝 Contributions

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

---

## 📬 Contact

For any inquiries or feedback, please reach out to hadiya.ymalik@gmail.com
