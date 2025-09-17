# Closetly - AI Fashion Try-On

## Project info

**AI-Powered Virtual Fashion Try-On | React + TypeScript + Google Gemini AI**
Experience the future of fashion with this innovative web application that enables virtual try-on of multiple garments using AI-powered image generation and advanced canvas composition.

✨ Features

**AI-Powered Try-On:** Google Gemini 2.0 Flash integration for realistic model generation

**Multi-Garment Support:** Upload and combine dresses, t-shirts, footwear, and accessories

**Smart Image Processing:** Advanced background removal and canvas-based composition

**Real-time Preview:** Instant visualization with gender selection and garment management

**Responsive Design:** Modern UI built with React, TypeScript, and Tailwind CSS

🛠️ Tech Stack

**Frontend:** React 18, TypeScript, Vite

**AI/ML:** Google Generative AI (Gemini 2.0 Flash)

**Styling:** Tailwind CSS, shadcn/ui components

**Image Processing:** Canvas API, custom background removal algorithms

**State Management:** React Hooks, Context API

## How can I edit this code?

There are several ways of editing your application.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## AI Try-On Setup

To enable Gemini-powered virtual try-on, provide a Google AI Studio API key:

```bash
echo "VITE_GOOGLE_AI_API_KEY=YOUR_API_KEY_HERE" > .env
```

Restart the dev server after adding the key.

## How can I deploy this project?

You can deploy this project to any static hosting service like Vercel, Netlify, or GitHub Pages.

Build the project:
```bash
npm run build
```

The built files will be in the `dist` directory.
