const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function register(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: '아이디는 영문/숫자/밑줄 3~20자여야 합니다.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);

  const user = { id: result.lastInsertRowid, username };
  const token = issueToken(user);

  return res.status(201).json({ token, user });
}

function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  const user = { id: row.id, username: row.username };
  const token = issueToken(user);

  return res.json({ token, user });
}

function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { register, login, me };
