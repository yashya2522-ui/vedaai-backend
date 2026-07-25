const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,

  email: {
    type: String,
    unique: true,
    required: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ["owner", "user"],
    default: "user"
  },

  isPremium: {
    type: Boolean,
    default: false
  },

  subscriptionType: {
    type: String,
    default: "free"
  },

  subscriptionExpiry: {
    type: Date,
    default: null
  },

    messageCount: {
    type: Number,
    default: 0
  },

  pdfCount: {
    type: Number,
    default: 0
  },

  imageCount: {
    type: Number,
    default: 0
  },

  lastLimitReset: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("User", UserSchema);
