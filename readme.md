# Task Management System

This project is a Task Management System built using the MERN stack (MongoDB, Express.js, React, and Node.js). The application allows users to create, update, delete, and manage tasks with different priorities and statuses.

## Features
- Full CRUD functionality for tasks.
- State management using Redux.
- API integration with backend.
- UI/UX optimizations.
- Routing with protected pages.

## Prerequisites
- Node.js (v14.x or higher)
- MongoDB (local or cloud instance)
- Git

## GitHub Repository
- Client Side: https://github.com/Nurmurad32/task-management-system-redux
- Server Side: https://github.com/Nurmurad32/task-management-system-redux-server

## Setup Instructions

1. **Clone the Repository of client & server**

   ```bash
   # Client Repository
   git clone [Repository](https://github.com/Nurmurad32/task-management-system-redux.git)

   # Server Repository
   git clone [Repository](https://github.com/Nurmurad32/task-management-system-redux-server.git)

2. **Install Dependencies & Run the Application**
   
    ```bash
    # Install client dependencies
    cd folder_name
    yarn
    yarn dev

    # Install server dependencies
    cd folder_name
    npm install
    npm run dev


3. **Configure Environment Variables for server**
   Create a .env file in the server directory with the following variables

    ```bash
    DB_USER=your_db_user
    DB_PASS=your_db_password
    JWT_SECRET=your_jwt_secret
