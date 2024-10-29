const { DataTypes } = require("sequelize");
const { sequelize } = require("../db/sequelize");

const Arbeitsagentur = sequelize.define(
  "Arbeitsagentur",
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    publishedDate: {
      type: DataTypes.STRING,
    },
    availability: {
      type: DataTypes.STRING,
    },
    employmentTypes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
    },
    location: {
      type: DataTypes.STRING,
    },
    education: {
      type: DataTypes.STRING,
    },
    qualification: {
      type: DataTypes.STRING,
    },
    experienceEntries: {
      type: DataTypes.JSONB,
    },
    languages: {
      type: DataTypes.JSONB,
    },
    skills: {
      type: DataTypes.ARRAY(DataTypes.STRING),
    },
  },
  {
    freezeTableName: true, // Tablo ismini sabitler
  }
);

module.exports = Arbeitsagentur;
