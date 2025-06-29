# Zenlit - Social Media App

A modern social media application built with Next.js 15, TypeScript, and Tailwind CSS that focuses on local connections and social verification.

## 🚀 Features

### Core Functionality
- **User Authentication** - Email/password login with OTP verification
- **Profile Management** - Customizable profiles with cover photos and bios
- **Social Media Verification** - OAuth integration for Instagram, Facebook, LinkedIn, Twitter, and Google
- **Local Discovery** - Radar feature to find nearby users
- **Messaging** - Real-time chat functionality
- **Content Sharing** - Photo/video posts with advanced camera features
- **Stories** - Temporary content sharing

### Social Verification System
- **OAuth Integration** - Verify ownership of social media accounts
- **Verified Badges** - Visual indicators for verified accounts
- **Trust Building** - Enhanced credibility through verified social presence
- **Multiple Providers** - Support for major social platforms

### Mobile-First Design
- **Responsive Layout** - Optimized for mobile devices
- **Touch Interactions** - Smooth animations and transitions
- **Native Feel** - iOS/Android-like user experience
- **Dark Theme** - Modern dark UI design
- **Smooth Animations** - Framer Motion powered transitions

## 🛠 Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Icons**: Heroicons, Tabler Icons
- **Animation**: Framer Motion
- **Database**: Supabase (configured)
- **Authentication**: Supabase Auth
- **State Management**: React Hooks
- **PWA**: Next-PWA for offline functionality

## 📱 Screens

1. **Welcome Screen** - App introduction and onboarding
2. **Login/Signup** - Authentication with email verification
3. **Radar Screen** - Discover nearby users
4. **Feed Screen** - View posts from all users
5. **Create Post** - Share photos/videos with an improved camera interface (flash toggle, camera flip, gallery import)
6. **Messages** - Chat with other users
7. **Profile Screen** - User profiles with social verification
8. **Edit Profile** - Update profile information and verify social accounts

## 🔧 Installation & Setup

1. **Clone the repository:**
```bash
git clone <your-repository-url>
cd zenlit-social
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env.local`
   - Update the Supabase credentials if needed

4. **Run Supabase migrations:**
```bash
cd supabase && npx supabase db reset
```

5. **Start the development server:**
```bash
npm run dev
```

6. **Open your browser:**
   Navigate to `http://localhost:3000`

## 🧪 Demo Account

Use the read-only demo account to explore the app without creating data:

```
Email: demo@zenlit.in
Password: zenlit123
```

Edits and posts are disabled for this account.

## 🏗 Project Structure

```
├── app/                    # Next.js 15 App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── common/       # Common components (Avatar, SocialLinks)
│   │   ├── messaging/    # Chat-related components
│   │   ├── post/         # Post-related components
│   │   ├── profile/      # Profile components
│   │   ├── radar/        # Radar screen components
│   │   ├── social/       # Social verification components
│   │   └── ui/           # shadcn/ui components
│   ├── screens/          # Main application screens
│   ├── data/             # Mock data and generators
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   └── App.tsx           # Main app component
├── lib/                  # Library configurations
│   ├── supabaseClient.ts # Supabase client setup
│   └── utils.ts          # Utility functions
├── components/ui/        # shadcn/ui components
└── public/               # Static assets
```

## 🔐 Social Media Authentication

The app includes a comprehensive social media verification system:

### Supported Platforms
- Instagram
- Facebook
- LinkedIn
- Twitter/X
- Google

### Verification Flow
1. User clicks "Connect" button for a social platform
2. OAuth flow initiates (currently mocked for demo)
3. User authorizes the application
4. Profile URL is retrieved and stored
5. Verified badge is displayed on user profile

### Implementation Notes
- OAuth flows are currently mocked for demonstration
- Ready for backend integration with real OAuth providers
- Secure token handling and profile verification
- Error handling for failed authentications

## 📊 Database Integration

The app is configured to work with Supabase:

- **Authentication**: Email/password with OTP verification
- **Real-time**: Ready for real-time messaging
- **Storage**: Profile pictures and post media
- **Database**: User profiles, posts, messages, social accounts

The `profiles` table also stores optional `latitude` and `longitude` fields for
local discovery. These coordinates are cleared on logout and automatically
removed if they haven't been updated in five minutes. A sample edge function for
this scheduled cleanup lives in `supabase/functions/cleanup-stale-locations`.

### Messaging Flow
Messages are stored in the `messages` table. When you start a conversation from the Radar screen the app automatically switches to the Messages tab and loads the chat history from Supabase.

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Environment Variables for Production
Make sure to set these in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Progressive Web App
The project is configured as a PWA using `next-pwa`. When built for production, the app can be installed on mobile devices and works offline.

## 🔮 Future Enhancements

- **Real-time Messaging** - WebSocket integration
- **Push Notifications** - Mobile notifications
- **Advanced Filtering** - Enhanced user discovery
- **Content Moderation** - Automated content filtering
- **Analytics Dashboard** - User engagement metrics
- **Premium Features** - Subscription-based enhancements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- React team for the amazing framework
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first styling
- Heroicons and Tabler Icons for beautiful icons
- Supabase for the backend infrastructure
- All contributors and testers

---

**Note**: This is a demo application with mocked authentication flows. For production use, implement proper backend services and real OAuth integrations.