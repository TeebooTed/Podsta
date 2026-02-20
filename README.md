Podsta
Your photos. Your Pod. Your rules.
A simple, decentralized photo-sharing app built entirely on Solid Pods.
Instead of uploading to Instagram, Facebook, or any central server, Podsta stores your photos and captions in your own personal Solid Pod. You own the data. You control who sees what. No algorithms. No surveillance. No lock-in.
Live Demo: https://podsta.vercel.app
GitHub Repo: github.com/yourusername/podsta
Why Podsta Exists
Big Tech social networks own your data. Podsta flips that.
It’s a practical demonstration of Tim Berners-Lee’s vision: a web where you control your personal data. Photos, captions, sharing permissions — everything lives in your Pod, and apps must ask permission to access anything.
This is the first step toward a truly user-owned social network.
Features

Upload photos + captions directly to your Inrupt Pod
Personal gallery — view everything you’ve posted
One-click public sharing — make individual photos publicly accessible
Revoke access anytime — just click again
Fully decentralized — no central server stores your data
Works on mobile & desktop (PWA-ready)
Open source & hackable

Quick Start
For Users

Get a free Solid Pod at pod.inrupt.com
Visit https://podsta.vercel.app
Click Log in with Inrupt Pod
Upload photos and start sharing!

For Developers (Run Locally)
Bashgit clone https://github.com/yourusername/podsta.git
cd podsta
npm install
npm run dev
Open http://localhost:5173
See the Setup Guide for deployment to Vercel or self-hosting.
How It Works

Photos are stored as binary files in your Pod at /photos/
Captions are stored as RDF metadata (.meta files) using schema:caption
Public sharing creates a minimal .acl file allowing foaf:Agent (public) read access
Authentication uses Solid-OIDC with dynamic client registration
Everything runs client-side in your browser

Roadmap

 Friends feed (view public photos from other Pods)
 Delete photos
 Rich caption editor
 Comments on public photos
 Mobile PWA install
 Public discovery / search

Contributing
We welcome contributions!

Bug reports & feature requests → Issues
Code contributions → fork, branch, PR
Documentation → this wiki

See Contributing for details.
Tech Stack

React + Vite
@inrupt/solid-client & @inrupt/solid-client-authn-browser
Tailwind CSS
Hosted on Vercel

License
MIT — free to use, modify, and build upon.
Made with ❤️ by Teeboo Ted as an exploration of user-owned data on the Solid web.
