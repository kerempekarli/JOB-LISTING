const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');

// İş ilanı modelini tanımlıyoruz
const JobListing = sequelize.define('JobListing', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  salary: {
    type: DataTypes.STRING,
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

// Modeli export ediyoruz
module.exports = JobListing;
