require('dotenv').config();
const express = require('express');
const { pool } = require('../../shared/db/db');

const app = express();
const PORT = process.env.PORT || 5001;

app.get('/api/super-admin/universities', async (req, res) => {
    const result = await pool.query('SELECT * FROM universities');
    res.json(result.rows);
});

app.listen(PORT, () => {
    console.log(`Super Admin system running on port ${PORT}`);
});