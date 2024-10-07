const { Sequelize } = require('sequelize');

// PostgreSQL veritabanı bağlantısını oluşturuyoruz
const sequelize = new Sequelize('joblistings', 'user', 'password', {
  host: 'localhost',
  dialect: 'postgres',
});

async function connectToDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Veritabanına başarıyla bağlanıldı.');
  } catch (error) {
    console.error('Veritabanına bağlanılamadı:', error);
  }
}

module.exports = { sequelize, connectToDatabase };
