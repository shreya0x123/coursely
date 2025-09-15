# 🚀 Coursely - A Modern Learning Management System (LMS)

Welcome to Coursely, a full-stack web application designed as an interactive and modern Learning Management System. This project allows users to sign up, log in, enroll in courses, track their progress, and take quizzes.

---

## ✨ Key Features

* **User Authentication:** Secure sign-up and sign-in functionality with password hashing.
* **Course Management:** Users can view a list of all available courses and enroll with a single click.
* **Personalized Dashboard:** A "My Courses" view shows only the courses a user is enrolled in.
* **Progress Tracking:** Each user's progress for every course is saved to their account.
* **Interactive Quizzes:** Each lesson features a quiz with automatic scoring to test a user's knowledge.
* **Full CRUD Functionality:** The application supports Create (register), Read (view courses), Update (quiz scores), and Delete (unenroll) operations.

---

## 🛠️ Technology Stack

This project was built from scratch using the following technologies:

* **Front-End:** HTML, CSS, and vanilla JavaScript (no frameworks).
* **Back-End:** Node.js with the Express.js framework for creating the API.
* **Database:** SQLite for lightweight, file-based data storage.
* **Authentication:** `bcrypt` for secure password hashing.

---

## 🏁 Getting Started

To run this project on your local machine, follow these steps.

### **Prerequisites**

* [Node.js](https://nodejs.org/) installed on your machine.
* The project files (`index.html`, `courses.html`, `server.js`, `coursely.db`).

### **Installation & Setup**

1.  **Clone the repository (or download the files):**
    ```bash
    git clone [https://github.com/your-username/coursely-project.git](https://github.com/your-username/coursely-project.git)
    cd coursely-project
    ```

2.  **Install back-end dependencies:**
    Open a terminal in the project folder and run:
    ```bash
    npm install express cors bcrypt sqlite3
    ```

3.  **Start the back-end server:**
    In the same terminal, run:
    ```bash
    node server.js
    ```
    You should see a confirmation message: `Server running on http://localhost:3000`. Keep this terminal window open.

4.  **Launch the front-end:**
    Open the `index.html` file in your web browser. You can now sign up for an account and start using the application.
