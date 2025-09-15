// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database('./coursely.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to the coursely.db SQLite database.');
});

// --- AUTH ENDPOINTS ---
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const sql = `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`;
        db.run(sql, [name, email, passwordHash], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') { return res.status(409).json({ message: 'This email is already registered.' }); }
                return res.status(500).json({ message: 'Database error.' });
            }
            res.status(201).json({ message: 'User created!', userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
            res.status(200).json({ message: 'Login successful!', user: { id: user.id, name: user.full_name } });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    });
});

// --- COURSE & PROGRESS ENDPOINTS ---
app.get('/courses', (req, res) => {
    const sql = `
        SELECT c.id as course_id, c.title as course_title, c.instructor, l.id as lesson_id, l.title as lesson_title
        FROM courses c LEFT JOIN lessons l ON c.id = l.course_id ORDER BY c.id, l.id;
    `;
    db.all(sql, [], (err, rows) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        const courses = {};
        rows.forEach(row => {
            if (!courses[row.course_id]) {
                courses[row.course_id] = { id: row.course_id, title: row.course_title, instructor: row.instructor, lessons: [] };
            }
            if (row.lesson_id) {
                courses[row.course_id].lessons.push({ id: row.lesson_id, title: row.lesson_title });
            }
        });
        res.json(Object.values(courses));
    });
});

app.get('/progress/:userId', (req, res) => {
    const { userId } = req.params;
    const sql = `
        SELECT e.course_id, l.id AS lesson_id, COALESCE(lp.is_completed, 0) AS is_completed, lp.quiz_score
        FROM enrollments e
        JOIN lessons l ON e.course_id = l.course_id
        LEFT JOIN lesson_progress lp ON lp.user_id = e.user_id AND lp.lesson_id = l.id
        WHERE e.user_id = ?
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("Database error fetching progress:", err.message);
            return res.status(500).json({ message: "Error fetching progress" });
        }
        res.json(rows);
    });
});

app.post('/enroll', (req, res) => {
    const { userId, courseId } = req.body;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION;');
        const enrollSql = `INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)`;
        db.run(enrollSql, [userId, courseId], function(err) {
            if (err) {
                db.run('ROLLBACK;');
                return res.status(500).json({ message: "Error enrolling in course" });
            }
            const lessonsSql = `SELECT id FROM lessons WHERE course_id = ?`;
            db.all(lessonsSql, [courseId], (err, lessons) => {
                if (err) {
                    db.run('ROLLBACK;');
                    return res.status(500).json({ message: "Error finding lessons for course" });
                }
                const progressSql = `INSERT INTO lesson_progress (user_id, lesson_id, is_completed, quiz_score) VALUES (?, ?, 0, NULL)`;
                lessons.forEach(lesson => {
                    db.run(progressSql, [userId, lesson.id]);
                });
                db.run('COMMIT;', (err) => {
                    if (err) { return res.status(500).json({ message: "Error committing transaction" }); }
                    res.status(200).json({ message: "Enrolled successfully" });
                });
            });
        });
    });
});

// --- NEW UNENROLL (DELETE) ENDPOINT ---
app.post('/unenroll', (req, res) => {
    const { userId, courseId } = req.body;
    if (!userId || !courseId) {
        return res.status(400).json({ message: "User ID and Course ID are required." });
    }

    db.serialize(() => {
        // Use a transaction to ensure both deletions succeed or fail together
        db.run('BEGIN TRANSACTION;');

        // 1. Delete all lesson progress for this user in this course
        const lessonSql = `DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id IN (SELECT id FROM lessons WHERE course_id = ?)`;
        db.run(lessonSql, [userId, courseId]);

        // 2. Delete the main enrollment record
        const enrollSql = `DELETE FROM enrollments WHERE user_id = ? AND course_id = ?`;
        db.run(enrollSql, [userId, courseId]);

        // 3. Commit the changes
        db.run('COMMIT;', (err) => {
            if (err) {
                db.run('ROLLBACK;');
                return res.status(500).json({ message: "Failed to unenroll." });
            }
            res.status(200).json({ message: "Successfully unenrolled." });
        });
    });
});


app.post('/lesson-progress', (req, res) => {
    const { userId, lessonId, isCompleted } = req.body;
    const sql = `UPDATE lesson_progress SET is_completed = ? WHERE user_id = ? AND lesson_id = ?`;
    db.run(sql, [isCompleted, userId, lessonId], (err) => {
        if (err) return res.status(500).json({ message: "Error updating lesson progress" });
        res.status(200).json({ message: "Progress updated" });
    });
});

// --- QUIZ ENDPOINTS ---
app.get('/quiz/:lessonId', (req, res) => {
    const { lessonId } = req.params;
    const sql = `
        SELECT q.id as question_id, q.question_text, o.id as option_id, o.option_text
        FROM questions q JOIN options o ON q.id = o.question_id WHERE q.lesson_id = ?
    `;
    db.all(sql, [lessonId], (err, rows) => {
        if (err) { return res.status(500).json({ message: "Error fetching quiz questions" }); }
        const questions = {};
        rows.forEach(row => {
            if (!questions[row.question_id]) {
                questions[row.question_id] = { id: row.question_id, text: row.question_text, options: [] };
            }
            questions[row.question_id].options.push({ id: row.option_id, text: row.option_text });
        });
        res.json(Object.values(questions));
    });
});

app.post('/quiz/submit', (req, res) => {
    const { userId, lessonId, answers } = req.body;
    const questionIds = Object.keys(answers);
    if (questionIds.length === 0) {
        return res.status(400).json({ message: "No answers submitted." });
    }
    const sql = `SELECT question_id, id as correct_option_id FROM options WHERE question_id IN (${questionIds.map(() => '?').join(',')}) AND is_correct = 1`;
    db.all(sql, questionIds, (err, correctAnswers) => {
        if (err) { return res.status(500).json({ message: "Error fetching correct answers." }); }
        let score = 0;
        correctAnswers.forEach(correctAnswer => {
            const questionId = correctAnswer.question_id;
            const correctOptionId = correctAnswer.correct_option_id;
            const userAnswerOptionId = answers[questionId];
            if (parseInt(userAnswerOptionId) === correctOptionId) {
                score++;
            }
        });
        const finalScore = Math.round((score / correctAnswers.length) * 100);
        const updateSql = `UPDATE lesson_progress SET quiz_score = ? WHERE user_id = ? AND lesson_id = ?`;
        db.run(updateSql, [finalScore, userId, lessonId]);
        res.json({ score: finalScore, total: correctAnswers.length, correctCount: score });
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});