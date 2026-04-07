# 🏨 HostelHub — Hostel Management System

HostelHub is a comprehensive hostel management system that enables students to manage their daily meal credits, vote on menu items, suggest new dishes, track facility status, and manage their hostel profiles. Built with Express.js backend and vanilla JavaScript frontend.

## ✨ Features

### For Students
- 🍽️ **Meal Management**: View and select daily meals with credit-based system
- 🗳️ **Voting System**: Vote for favorite menu items and suggestions
- 💳 **Credit Tracking**: Monitor meal credits with monthly allocations and bonus credits
- 🎉 **Festival Bonuses**: Get extra credits on festivals and Sundays
- 🏢 **Facility Monitoring**: Track hostel facility status and maintenance
- 💡 **Suggestions**: Submit and vote on new menu item suggestions
- 👤 **Profile Management**: Update personal information and track credit history

### For Admins
- 👥 **Student Management**: Add, edit, and verify student accounts
- 🍴 **Menu Management**: Add, edit, and remove menu items across all meal slots
- 🏗️ **Facility Management**: Update facility status and maintenance info
- 📊 **Dashboard**: Monitor hostel statistics and student activities
- 🎯 **Suggestion Review**: Review and approve student suggestions

## 🏗️ Architecture

```
hostelhub/
├── backend/
│   ├── server.js          # Express server with MongoDB
│   ├── package.json       # Backend dependencies
│   └── db.json           # Legacy backup data
├── frontend/
│   └── public/
│       ├── index.html    # Main application UI
│       └── app.js        # Frontend JavaScript logic
└── package.json          # Root package
```

## 🚀 Quick Start

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed local development setup instructions.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Basic Setup

1. Clone the repository
```bash
git clone https://github.com/saransh-sh/hostelhub.git
cd hostelhub
```

2. Install dependencies
```bash
npm install
cd backend && npm install
```

3. Configure environment variables (see `.env.example`)
```bash
cp .env.example .env
# Edit .env with your MongoDB URI
```

4. Start the server
```bash
cd backend
npm start
```

5. Access the application at `http://localhost:3000`

## 🔐 Default Credentials

After seeding, use these credentials to login:

**Admin Account:**
- Email: `admin@hostel.com`
- Password: `admin123`

**Student Account:**
- Email: `student@hostel.com`
- Password: `pass123`

## 🛠️ Tech Stack

### Backend
- **Express.js** - Web framework
- **MongoDB** - Database (via Mongoose ODM)
- **CORS** - Cross-origin resource sharing
- **Crypto** - Password hashing and session tokens

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 & CSS3** - Modern UI
- **Fetch API** - HTTP requests

## 📡 API Overview

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `POST /api/logout` - User logout

### Student Endpoints
- `GET /api/students` - List all students
- `POST /api/students` - Add new student (admin only)
- `PUT /api/students/:id` - Update student (admin only)
- `DELETE /api/students/:id` - Remove student (admin only)

### Menu Endpoints
- `GET /api/menu` - Get all menu items
- `POST /api/menu` - Add menu item (admin only)
- `PUT /api/menu/:id` - Update menu item (admin only)
- `DELETE /api/menu/:id` - Delete menu item (admin only)

### Voting & Suggestions
- `POST /api/vote/:itemId` - Vote for menu item
- `GET /api/suggestions` - Get all suggestions
- `POST /api/suggestions` - Submit suggestion
- `POST /api/suggestions/:id/vote` - Vote for suggestion

### Profile & Credits
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update profile
- `POST /api/credits/sweet` - Use sweet credits
- `POST /api/credits/bonus` - Claim daily bonus

For complete API documentation, see the inline documentation in `backend/server.js`.

## 🎯 Key Concepts

### Credit System
- Students receive monthly credits based on days in the month (6 credits per day)
- Free items (bread + tea, basic dal) cost 0 credits
- Premium items cost 1-8 credits
- Bonus credits available on Sundays (+4) and festivals (+6)

### Voting System
- Students can vote for menu items (max 3 votes per day)
- Vote for suggestions to promote them
- Admin can see vote counts for decision-making

### Sweet Credits
- Special monthly allocation for desserts
- Tracked separately from meal credits

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.

## 🐛 Known Issues

- Session storage is in-memory (will be lost on server restart)
- No password reset functionality yet
- Limited input validation on frontend

## 🔮 Future Enhancements

- [ ] Email notifications
- [ ] QR code meal scanning
- [ ] Mobile app
- [ ] Analytics dashboard
- [ ] Complaint management system
- [ ] Redis for session management
- [ ] JWT authentication
- [ ] Image uploads for facilities

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

Made with ❤️ for hostel students everywhere
