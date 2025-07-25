const fs = require("fs-extra");
const path = require("path");
const fetch = require("node-fetch");
const { getAudioDurationInSeconds } = require("get-audio-duration");
const { Message } = require("discord.js");
const {
  audioDict,
  categoryList,
  audioPath,
  tempDataPath,
  audioBucket,
  recentlyUploadedList,
  sqlDatabase,
} = require("../data");
const { kevbotStringOkay } = require("../functions/helpers/kevbotStringOkay");
const { getFiles } = require("../functions/helpers/getFiles");
const { asyncPipe } = require("../functions/helpers/asyncPipe");
const { normalizeAudio } = require("../functions/helpers/normalizeAudio");

module.exports = {
  name: "upload",
  description:
    "Upload an mp3 file to the bot. Make sure to attach the mp3 file to the message. 15 sec max. 15 char file name max. You can optionally add the file to categories as well.",
  usage: "upload!category1 category2 category3...",
  /**
   * @param {Object} methodargs
   * @param {Message} methodargs.message
   * @param {Array.<string>} methodargs.args
   */
  execute({ message, args }) {
    return new Promise(async (resolve, reject) => {
      // Get discord id and check that it is valid
      let discordId = message?.author?.id;
      if (!discordId) {
        return reject({ userMess: `Failed to retrieve discord id!` });
      }

      // Check if a file was actually attached
      if (!(message.attachments.size !== 0)) {
        return reject({ userMess: "You did not attach a file ya dingus!" });
      }

      // Check if a category argument was given and if it is valid
      let categories = args;
      let categoryGiven = categories !== undefined;
      if (categoryGiven) {
        for (let category of categories) {
          if (!categoryList.includes(category)) {
            return reject({ userMess: `The category "${category}" does not exist! Upload failed!` });
          }
        }
      }

      // Determining the url, filename, and extension of the attached file
      const messageAttachment = message.attachments.values().next().value;
      const discordFileUrl = messageAttachment.url;
      const fileName = messageAttachment.name;
      const audioName = fileName.split(".")[0];
      const fileExtension = fileName.split(".")[1];
      const filePath = path.join(audioPath, fileName);
      const downloadFilePath = path.join(tempDataPath, "downloaded_file.mp3");

      // Check that the file name is not too long
      const MAX_COMMAND_NAME_LENGTH = 15;
      if (audioName.length > MAX_COMMAND_NAME_LENGTH) {
        return reject({
          userMess: `The file name can only be ${MAX_COMMAND_NAME_LENGTH} characters long, not including the .mp3.`,
        });
      }

      // check that the filename format
      if (!kevbotStringOkay(audioName)) {
        return reject({ userMess: `The file name can only contain lower case letters and numbers.` });
      }

      // Check that the file is actually an mp3
      if (fileExtension !== "mp3") {
        return reject({
          userMess: "The file you are trying to upload is not an mp3 file! You can only upload mp3 files.",
        });
      }

      // Getting list of files from cloud server
      try {
        var cloudFiles = await getFiles(audioBucket);
      } catch (err) {
        return reject({
          userMess: "Failed to retrieve files from the cloud server! Talk to Kevin.",
          err: err,
        });
      }

      // Check if the file is already on the server
      if (cloudFiles.includes(fileName)) {
        return reject({ userMess: `"${fileName}" is already on the cloud server, please pick a new name.` });
      }

      // Download file from discord to a local file path
      try {
        var response = await fetch(discordFileUrl);
        var readStream = response.body;
        var writeSteam = fs.createWriteStream(downloadFilePath);
        await asyncPipe(readStream, writeSteam);
        //await readStream.pipe(fs.createWriteStream(downloadFilePath));
      } catch (err) {
        return reject({
          userMess: "The file failed to download from discord! Try again later.",
          err: err,
        });
      }

      // Check the duration of file does not exceed the max duration
      const MAX_UPLOAD_CLIP_DURATION = 15; // sec
      try {
        var duration = await getAudioDurationInSeconds(downloadFilePath);
        if (duration >= MAX_UPLOAD_CLIP_DURATION) {
          return reject({
            userMess: `${fileName} has a duration of ${duration} sec. Max duration is ${MAX_UPLOAD_CLIP_DURATION} sec. Talk to Kevin for exceptions to this rule`,
          });
        }
      } catch (err) {
        return reject({
          userMess: "Failed to get audio duration! Try again later.",
          err: err,
        });
      }

      // Call the normalize audio function
      try {
        await normalizeAudio(downloadFilePath, filePath, duration);
      } catch (err) {
        return reject({
          userMess: "The file failed to normalize! Talk to Kevin.",
          err: err,
        });
      }

      // Upload file to google cloud server
      try {
        await audioBucket.upload(filePath, {
          resumable: false,
          metadata: {
            contentType: "audio/mpeg",
          },
        });
      } catch (err) {
        return reject({
          userMess: "The file failed to upload to the cloud server. Try again later.",
          err: err,
        });
      }

      // Add to audio dictionary and audio folder
      try {
        audioDict[audioName] = {
          localPath: filePath,
          cloudPath: `${audioName}.mp3`,
          isDownloaded: true,
        };
      } catch (err) {
        return reject({
          userMess: "File uploaded, but audio dictionary failed to update. Definitely let Kevin know!",
          err: err,
        });
      }

      // Update the SQL server table
      try {
        let results = await sqlDatabase.asyncQuery(
          `CALL add_audio('${discordId}', '${audioName}', '${duration}', @message); SELECT @message;`
        );
        let rtnMess = results[1][0]["@message"];
        if (rtnMess !== "Success") {
          return reject({
            userMess: `File uploaded, but failed to add audio "${audioName}" to the SQL audio Table. Definitely let Kevin know!`,
            err: rtnMess,
          });
        }
      } catch (err) {
        return reject({
          userMess: `File uploaded, but the add_audio stored procedure failed. Definitely let Kevin know!`,
          err: err,
        });
      }

      // Clean up the temporary data
      try {
        await fs.emptyDir(tempDataPath);
      } catch (err) {
        return reject({
          userMess: "File uploaded, but cleanup failed. Definitely let Kevin know!",
          err: err,
        });
      }

      // If a category was given then add the audio to the category
      if (categoryGiven) {
        try {
          await message.client.commands.get("addcatsto").execute(message, [audioName, categories]);
        } catch (err) {
          return reject({
            userMess:
              err.userMess +
              `\nUpload succeeded, but something went wrong when attempting to add the audio to the given categories.`,
            err: err,
          });
        }
      }

      // On every upload update the recently uploaded list
      recentlyUploadedList.pop();
      recentlyUploadedList.unshift({
        audio: audioName,
        datetime: Date.now(),
      });

      // return resolve promise
      return resolve({ userMess: `"${fileName}" has been uploaded to kev-bot!` });
    });
  },
};
