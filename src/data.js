const { SqlDatabase } = require("./db/SqlDatabase");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
require("dotenv").config();

// Google Cloud Bucket
const storageConfig = {};
if (process.env.KEVBOT_ENV === "LOCAL_DEV") {
  storageConfig.apiEndpoint = process.env.GCP_API_ENDPOINT;
  storageConfig.projectId = "kevbot-local-dev";
} else {
  storageConfig.projectId = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS).project_id;
  storageConfig.credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
}

const audioBucket = new Storage(storageConfig).bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME);

// SQL Database

const sqlDatabaseConfig = {
  connectionLimit: 10,
  host: process.env.SQL_DB_HOST,
  user: process.env.SQL_DB_USER,
  password: process.env.SQL_DB_PASSWORD,
  database: process.env.SQL_DB_DATABASE,
  port: process.env.SQL_DB_PORT,
  multipleStatements: true,
  dateStrings: true,
};

if (process.env.KEVBOT_ENV !== "LOCAL_DEV") {
  sqlDatabaseConfig.ssl = {
    ca: process.env.SQL_DB_SSL_CA,
  };
}

const sqlDatabase = new SqlDatabase(sqlDatabaseConfig);

// Data structures for use throughout code
// TODO: audioDict should be private now, ensureFileIsDownloaded is the public api
const audioDict = {}; // Audio dictionary, just maps names to filepaths. audioDict[name] -> {localPath: filepath, cloudPath: cloudPath, isDownloaded: boolean}
const categoryDict = {}; // category dictionary, maps category names to sets of audio categoryDict[category_name] -> [audio1, audio2, audio3, ...]
const categoryList = []; // Just a simple list of categories
var mostPlayedList = []; // Most played list [{audio,playCount},{audio,playCount},..] (sorted by playCount)
var uploadsByDiscordId = {}; // List of uploads done by each discord ID
var recentlyPlayedList = []; // List of recently played audio [{audio,datetime},{audio,datetime},..] (sorted by datetime)
var recentlyUploadedList = []; // List of the recently uploaded audio [{audio,datetime},{audio,datetime},..] (sorted by datetime)

// paths
const tempPath = path.join(__dirname, "./temp/");
const audioPath = path.join(__dirname, "./temp/audio/");
const tempDataPath = path.join(__dirname, "./temp/data/");

// Protected named
const protectedCategoryNames = [
  "categories",
  "cats",
  "emptycats",
  "all",
  "mostplayed",
  "myuploads",
  "playhistory",
  "uploadhistory",
];

module.exports = {
  audioBucket,
  sqlDatabase,
  audioDict,
  categoryDict,
  categoryList,
  mostPlayedList,
  uploadsByDiscordId,
  recentlyPlayedList,
  recentlyUploadedList,
  tempPath,
  audioPath,
  tempDataPath,
  protectedCategoryNames,
};
