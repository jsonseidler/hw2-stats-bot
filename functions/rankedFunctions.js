//setup variables
const auth = require("../auth.json"); //token file for discord
const util = require("util"); //string formatting
const http = require("https"); //api access
const helperFunctions = require("./helperFunctions"); //helper functions file

var get1X = function(options, eventVariables, gamertag, gamertagFormatted) {
  //get request
  http.get(options, (res) => {
    //check for valid gamertag
    if (res.statusCode == 404) {
      //send error message for invalid gamertag
      eventVariables.channel.send(util.format("<@!%s>, that gamertag does not exist.", eventVariables.userID));
      return(1);
    }

    //get user stats
    var rawData = "";
    res.on("data", (chunk) => { rawData += chunk; });

    //create and send message when all data is received
    res.on("end", () => {
      //parse data
      const parsedData = JSON.parse(rawData);

      //check if user has not played games
      if(parsedData.RankedPlaylistStats.length == 0) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any ranked games.", eventVariables.userID, gamertag));
        return(1);
      }

      //find correct index
      var index = -1;
      for(var i = 0; i < parsedData.RankedPlaylistStats.length; i++) {
        //find ranked 1x id
        if(parsedData.RankedPlaylistStats[i].PlaylistId == "548d864e-8666-430e-9140-8dd2ad8fbfcd") {
          index = i;
          break;
        }
      }

      //check if user has not played games
      if(parsedData.RankedPlaylistStats[index] == undefined) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any games of 1v1 X War.", eventVariables.userID, gamertag));
        return(1);
      } else {
        //get and format time played
        var iso = parsedData.RankedPlaylistStats[index].TotalTimePlayed;
        var timePlayed = "";
        if(iso.includes("D")) {
          timePlayed += iso.substring(iso.indexOf("P")+1, iso.indexOf("D"));
          timePlayed += "d ";
        }
        if(iso.includes("H")) {
          timePlayed += iso.substring(iso.indexOf("T")+1, iso.indexOf("H"));
          timePlayed += "h ";
        }
        if(iso.includes("M")) {
          if(iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("H") || iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("T")) {
            timePlayed += iso.substring(iso.indexOf("M")-1, iso.indexOf("M"));
            timePlayed += "m";
          } else {
            timePlayed += iso.substring(iso.indexOf("M")-2, iso.indexOf("M"));
            timePlayed += "m";
          }
        }

        //get games information
        var gamesPlayed = parsedData.RankedPlaylistStats[index].TotalMatchesStarted;
        var gamesWon = parsedData.RankedPlaylistStats[index].TotalMatchesWon;
        var gamesLost = parsedData.RankedPlaylistStats[index].TotalMatchesLost;
        var winPercent = helperFunctions.precisionRound((gamesWon / gamesPlayed) * 100, 2);

        //get favorite leader
        var max = -1;
        var favoriteLeader = "";
        for(var leader in parsedData.RankedPlaylistStats[index].LeaderStats) {
          if(parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted > max) {
            max = parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted;
            favoriteLeader = leader;
            if(favoriteLeader == "Lekgolo") {
              favoriteLeader = "Colony"
            }
          }
        }

        //information to connect to haloapi
        const options = {
          hostname: "www.haloapi.com",
          path: util.format("/stats/hw2/playlist/548d864e-8666-430e-9140-8dd2ad8fbfcd/rating?players=%s", gamertagFormatted),
          headers: {
            "Ocp-Apim-Subscription-Key": auth.key
          }
        };

        //get rank information and print message
        http.get(options, (res) => {
          //get user stats
          var rawData = "";
          res.on("data", (chunk) => { rawData += chunk; });

          res.on("end", () => {
            //parse data
            const parsedData = JSON.parse(rawData);


            if(parsedData.Results[0].Result.Csr.Designation == null) {
              var rank = "Unranked";
              var rankNumber = 0;
              var rankPercent = "";
              var tier = "";
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = 0;
            } else {
              var ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Onyx", "Champion"];
              var rankNumber = parsedData.Results[0].Result.Csr.Designation;
              var rank = ranks[rankNumber-1];
              var rankPercentNumber = parsedData.Results[0].Result.Csr.PercentToNextTier;
              if(rankPercentNumber != 0) {
                var rankPercent = " (" + rankPercentNumber + "%)";
              } else {
                  var rankPercent = "";
              }
              var tier = " ";
              if(rank == "Champion") {
                tier += parsedData.Results[0].Result.Csr.Rank;
              } else if(rank != "Onyx") {
                tier += parsedData.Results[0].Result.Csr.Tier;
              }
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = parsedData.Results[0].Result.Csr.Raw;
            }

            //create message
            var message = "Rank: "+ rank + tier + rankPercent +"\n";
            message += "Raw CSR: "+ csr +"\n";
            message += "MMR: "+ mmr +"\n";
            message += "Time played: "+ timePlayed +"\n";
            message += "Games played: "+ gamesPlayed +"\n";
            message += "Games won: "+ gamesWon +"\n";
            message += "Games lost: "+ gamesLost +"\n";
            message += "Win percentage: "+ winPercent +"%\n";
            message += "Favorite leader: "+ favoriteLeader;

            //check if bot has permission to embed links
            if(!eventVariables.guild.me.permissionsIn(eventVariables.channel).has("EMBED_LINKS")) {
              //send error message for no permissions
              eventVariables.channel.send(util.format("<@!%s>, make sure that I have the permissions to embed links.", eventVariables.userID));
              return(1);
            }

            //send embedded message with stats
            eventVariables.channel.send({ embed: {
              author: {
                name: "Ranked Stats for " + gamertag
              },
              color: eventVariables.embedcolor,
              thumbnail: {
                url: "attachment://designation.png",
                height: 1920 * .01,
                width: 1452 * .01
              },
              fields: [
                {
                  name: "1v1 X War",
                  value: message,
                  inline: true
                }
              ]

            }, files: [
              {
                attachment: util.format("./assets/designations/%s.png", rankNumber),
                name: "designation.png"
              }
            ]});
          });
        });
      }
    });
  });
}

var get3X = function(options, eventVariables, gamertag, gamertagFormatted) {
  //get request
  http.get(options, (res) => {
    //check for valid gamertag
    if (res.statusCode == 404) {
      //send error message for invalid gamertag
      eventVariables.channel.send(util.format("<@!%s>, that gamertag does not exist.", eventVariables.userID));
      return(1);
    }

    //get user stats
    var rawData = "";
    res.on("data", (chunk) => { rawData += chunk; });

    //create and send message when all data is received
    res.on("end", () => {
      //parse data
      const parsedData = JSON.parse(rawData);

      //check if user has not played games
      if(parsedData.RankedPlaylistStats.length == 0) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any ranked games.", eventVariables.userID, gamertag));
        return(1);
      }

      //find correct index
      var index = -1;
      for(var i = 0; i < parsedData.RankedPlaylistStats.length; i++) {
        //find ranked 3x id
        if(parsedData.RankedPlaylistStats[i].PlaylistId == "4a2cedcc-9098-4728-886f-60649896278d") {
          index = i;
          break;
        }
      }

      //check if user has not played games
      if(parsedData.RankedPlaylistStats[index] == undefined) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any games of 1v1 X War.", eventVariables.userID, gamertag));
        return(1);
      } else {
        //get and format time played
        var iso = parsedData.RankedPlaylistStats[index].TotalTimePlayed;
        var timePlayed = "";
        if(iso.includes("D")) {
          timePlayed += iso.substring(iso.indexOf("P")+1, iso.indexOf("D"));
          timePlayed += "d ";
        }
        if(iso.includes("H")) {
          timePlayed += iso.substring(iso.indexOf("T")+1, iso.indexOf("H"));
          timePlayed += "h ";
        }
        if(iso.includes("M")) {
          if(iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("H") || iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("T")) {
            timePlayed += iso.substring(iso.indexOf("M")-1, iso.indexOf("M"));
            timePlayed += "m";
          } else {
            timePlayed += iso.substring(iso.indexOf("M")-2, iso.indexOf("M"));
            timePlayed += "m";
          }
        }

        //get games information
        var gamesPlayed = parsedData.RankedPlaylistStats[index].TotalMatchesStarted;
        var gamesWon = parsedData.RankedPlaylistStats[index].TotalMatchesWon;
        var gamesLost = parsedData.RankedPlaylistStats[index].TotalMatchesLost;
        var winPercent = helperFunctions.precisionRound((gamesWon / gamesPlayed) * 100, 2);

        //get favorite leader
        var max = -1;
        var favoriteLeader = "";
        for(var leader in parsedData.RankedPlaylistStats[index].LeaderStats) {
          if(parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted > max) {
            max = parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted;
            favoriteLeader = leader;
            if(favoriteLeader == "Lekgolo") {
              favoriteLeader = "Colony"
            }
          }
        }

        //information to connect to haloapi
        const options = {
          hostname: "www.haloapi.com",
          path: util.format("/stats/hw2/playlist/4a2cedcc-9098-4728-886f-60649896278d/rating?players=%s", gamertagFormatted),
          headers: {
            "Ocp-Apim-Subscription-Key": auth.key
          }
        };

        //get rank information and print message
        http.get(options, (res) => {
          //get user stats
          var rawData = "";
          res.on("data", (chunk) => { rawData += chunk; });

          res.on("end", () => {
            //parse data
            const parsedData = JSON.parse(rawData);


            if(parsedData.Results[0].Result.Csr.Designation == null) {
              var rank = "Unranked";
              var rankNumber = 0;
              var rankPercent = "";
              var tier = "";
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = 0;
            } else {
              var ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Onyx", "Champion"];
              var rankNumber = parsedData.Results[0].Result.Csr.Designation;
              var rank = ranks[rankNumber-1];
              var rankPercentNumber = parsedData.Results[0].Result.Csr.PercentToNextTier;
              if(rankPercentNumber != 0) {
                var rankPercent = " (" + rankPercentNumber + "%)";
              } else {
                  var rankPercent = "";
              }
              var tier = " ";
              if(rank == "Champion") {
                tier += parsedData.Results[0].Result.Csr.Rank;
              } else if(rank != "Onyx") {
                tier += parsedData.Results[0].Result.Csr.Tier;
              }
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = parsedData.Results[0].Result.Csr.Raw;
            }

            //create message
            var message = "Rank: "+ rank + tier + rankPercent +"\n";
            message += "Raw CSR: "+ csr +"\n";
            message += "MMR: "+ mmr +"\n";
            message += "Time played: "+ timePlayed +"\n";
            message += "Games played: "+ gamesPlayed +"\n";
            message += "Games won: "+ gamesWon +"\n";
            message += "Games lost: "+ gamesLost +"\n";
            message += "Win percentage: "+ winPercent +"%\n";
            message += "Favorite leader: "+ favoriteLeader;

            //check if bot has permission to embed links
            if(!eventVariables.guild.me.permissionsIn(eventVariables.channel).has("EMBED_LINKS")) {
              //send error message for no permissions
              eventVariables.channel.send(util.format("<@!%s>, make sure that I have the permissions to embed links.", eventVariables.userID));
              return(1);
            }

            //send embedded message with stats
            eventVariables.channel.send({ embed: {
              author: {
                name: "Ranked Stats for " + gamertag
              },
              color: eventVariables.embedcolor,
              thumbnail: {
                url: "attachment://designation.png",
                height: 1920 * .01,
                width: 1452 * .01
              },
              fields: [
                {
                  name: "3v3 X War",
                  value: message,
                  inline: true
                }
              ]

            }, files: [
              {
                attachment: util.format("./assets/designations/%s.png", rankNumber),
                name: "designation.png"
              }
            ]});
          });
        });
      }
    });
  });
}

var get2 = function(options, eventVariables, gamertag, gamertagFormatted) {
  //get request
  http.get(options, (res) => {
    //check for valid gamertag
    if (res.statusCode == 404) {
      //send error message for invalid gamertag
      eventVariables.channel.send(util.format("<@!%s>, that gamertag does not exist.", eventVariables.userID));
      return(1);
    }

    //get user stats
    var rawData = "";
    res.on("data", (chunk) => { rawData += chunk; });

    //create and send message when all data is received
    res.on("end", () => {
      //parse data
      const parsedData = JSON.parse(rawData);

      //check if user has not played games
      if(parsedData.RankedPlaylistStats.length == 0) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any ranked games.", eventVariables.userID, gamertag));
        return(1);
      }

      //find correct index
      var index = -1;
      for(var i = 0; i < parsedData.RankedPlaylistStats.length; i++) {
        //find ranked 2 id
        if(parsedData.RankedPlaylistStats[i].PlaylistId == "7c625f1c-4c66-4484-8cde-a261e3b4d104") {
          index = i;
          break;
        }
      }

      //check if user has not played games
      if(parsedData.RankedPlaylistStats[index] == undefined) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any games of 1v1 X War.", eventVariables.userID, gamertag));
        return(1);
      } else {
        //get and format time played
        var iso = parsedData.RankedPlaylistStats[index].TotalTimePlayed;
        var timePlayed = "";
        if(iso.includes("D")) {
          timePlayed += iso.substring(iso.indexOf("P")+1, iso.indexOf("D"));
          timePlayed += "d ";
        }
        if(iso.includes("H")) {
          timePlayed += iso.substring(iso.indexOf("T")+1, iso.indexOf("H"));
          timePlayed += "h ";
        }
        if(iso.includes("M")) {
          if(iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("H") || iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("T")) {
            timePlayed += iso.substring(iso.indexOf("M")-1, iso.indexOf("M"));
            timePlayed += "m";
          } else {
            timePlayed += iso.substring(iso.indexOf("M")-2, iso.indexOf("M"));
            timePlayed += "m";
          }
        }

        //get games information
        var gamesPlayed = parsedData.RankedPlaylistStats[index].TotalMatchesStarted;
        var gamesWon = parsedData.RankedPlaylistStats[index].TotalMatchesWon;
        var gamesLost = parsedData.RankedPlaylistStats[index].TotalMatchesLost;
        var winPercent = helperFunctions.precisionRound((gamesWon / gamesPlayed) * 100, 2);

        //get favorite leader
        var max = -1;
        var favoriteLeader = "";
        for(var leader in parsedData.RankedPlaylistStats[index].LeaderStats) {
          if(parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted > max) {
            max = parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted;
            favoriteLeader = leader;
            if(favoriteLeader == "Lekgolo") {
              favoriteLeader = "Colony"
            }
          }
        }

        //information to connect to haloapi
        const options = {
          hostname: "www.haloapi.com",
          path: util.format("/stats/hw2/playlist/7c625f1c-4c66-4484-8cde-a261e3b4d104/rating?players=%s", gamertagFormatted),
          headers: {
            "Ocp-Apim-Subscription-Key": auth.key
          }
        };

        //get rank information and print message
        http.get(options, (res) => {
          //get user stats
          var rawData = "";
          res.on("data", (chunk) => { rawData += chunk; });

          res.on("end", () => {
            //parse data
            const parsedData = JSON.parse(rawData);


            if(parsedData.Results[0].Result.Csr.Designation == null) {
              var rank = "Unranked";
              var rankNumber = 0;
              var rankPercent = "";
              var tier = "";
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = 0;
            } else {
              var ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Onyx", "Champion"];
              var rankNumber = parsedData.Results[0].Result.Csr.Designation;
              var rank = ranks[rankNumber-1];
              var rankPercentNumber = parsedData.Results[0].Result.Csr.PercentToNextTier;
              if(rankPercentNumber != 0) {
                var rankPercent = " (" + rankPercentNumber + "%)";
              } else {
                  var rankPercent = "";
              }
              var tier = " ";
              if(rank == "Champion") {
                tier += parsedData.Results[0].Result.Csr.Rank;
              } else if(rank != "Onyx") {
                tier += parsedData.Results[0].Result.Csr.Tier;
              }
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = parsedData.Results[0].Result.Csr.Raw;
            }

            //create message
            var message = "Rank: "+ rank + tier + rankPercent +"\n";
            message += "Raw CSR: "+ csr +"\n";
            message += "MMR: "+ mmr +"\n";
            message += "Time played: "+ timePlayed +"\n";
            message += "Games played: "+ gamesPlayed +"\n";
            message += "Games won: "+ gamesWon +"\n";
            message += "Games lost: "+ gamesLost +"\n";
            message += "Win percentage: "+ winPercent +"%\n";
            message += "Favorite leader: "+ favoriteLeader;

            //check if bot has permission to embed links
            if(!eventVariables.guild.me.permissionsIn(eventVariables.channel).has("EMBED_LINKS")) {
              //send error message for no permissions
              eventVariables.channel.send(util.format("<@!%s>, make sure that I have the permissions to embed links.", eventVariables.userID));
              return(1);
            }

            //send embedded message with stats
            eventVariables.channel.send({ embed: {
              author: {
                name: "Ranked Stats for " + gamertag
              },
              color: eventVariables.embedcolor,
              thumbnail: {
                url: "attachment://designation.png",
                height: 1920 * .01,
                width: 1452 * .01
              },
              fields: [
                {
                  name: "Xbox 2v2 War",
                  value: message,
                  inline: true
                }
              ]

            }, files: [
              {
                attachment: util.format("./assets/designations/%s.png", rankNumber),
                name: "designation.png"
              }
            ]});
          });
        });
      }
    });
  });
}

var get3 = function(options, eventVariables, gamertag, gamertagFormatted) {
  //get request
  http.get(options, (res) => {
    //check for valid gamertag
    if (res.statusCode == 404) {
      //send error message for invalid gamertag
      eventVariables.channel.send(util.format("<@!%s>, that gamertag does not exist.", eventVariables.userID));
      return(1);
    }

    //get user stats
    var rawData = "";
    res.on("data", (chunk) => { rawData += chunk; });

    //create and send message when all data is received
    res.on("end", () => {
      //parse data
      const parsedData = JSON.parse(rawData);

      //check if user has not played games
      if(parsedData.RankedPlaylistStats.length == 0) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any ranked games.", eventVariables.userID, gamertag));
        return(1);
      }

      //find correct index
      var index = -1;
      for(var i = 0; i < parsedData.RankedPlaylistStats.length; i++) {
        //find ranked 3 id
        if(parsedData.RankedPlaylistStats[i].PlaylistId == "fe8e1773-adc6-43d0-a23f-4599987ce0f4") {
          index = i;
          break;
        }
      }

      //check if user has not played games
      if(parsedData.RankedPlaylistStats[index] == undefined) {
        //send error message for invalid gamertag
        eventVariables.channel.send(util.format("<@!%s>, %s has not played any games of 1v1 X War.", eventVariables.userID, gamertag));
        return(1);
      } else {
        //get and format time played
        var iso = parsedData.RankedPlaylistStats[index].TotalTimePlayed;
        var timePlayed = "";
        if(iso.includes("D")) {
          timePlayed += iso.substring(iso.indexOf("P")+1, iso.indexOf("D"));
          timePlayed += "d ";
        }
        if(iso.includes("H")) {
          timePlayed += iso.substring(iso.indexOf("T")+1, iso.indexOf("H"));
          timePlayed += "h ";
        }
        if(iso.includes("M")) {
          if(iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("H") || iso.substring(iso.indexOf("M")-2, iso.indexOf("M")).includes("T")) {
            timePlayed += iso.substring(iso.indexOf("M")-1, iso.indexOf("M"));
            timePlayed += "m";
          } else {
            timePlayed += iso.substring(iso.indexOf("M")-2, iso.indexOf("M"));
            timePlayed += "m";
          }
        }

        //get games information
        var gamesPlayed = parsedData.RankedPlaylistStats[index].TotalMatchesStarted;
        var gamesWon = parsedData.RankedPlaylistStats[index].TotalMatchesWon;
        var gamesLost = parsedData.RankedPlaylistStats[index].TotalMatchesLost;
        var winPercent = helperFunctions.precisionRound((gamesWon / gamesPlayed) * 100, 2);

        //get favorite leader
        var max = -1;
        var favoriteLeader = "";
        for(var leader in parsedData.RankedPlaylistStats[index].LeaderStats) {
          if(parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted > max) {
            max = parsedData.RankedPlaylistStats[index].LeaderStats[leader].TotalMatchesStarted;
            favoriteLeader = leader;
            if(favoriteLeader == "Lekgolo") {
              favoriteLeader = "Colony"
            }
          }
        }

        //information to connect to haloapi
        const options = {
          hostname: "www.haloapi.com",
          path: util.format("/stats/hw2/playlist/fe8e1773-adc6-43d0-a23f-4599987ce0f4/rating?players=%s", gamertagFormatted),
          headers: {
            "Ocp-Apim-Subscription-Key": auth.key
          }
        };

        //get rank information and print message
        http.get(options, (res) => {
          //get user stats
          var rawData = "";
          res.on("data", (chunk) => { rawData += chunk; });

          res.on("end", () => {
            //parse data
            const parsedData = JSON.parse(rawData);


            if(parsedData.Results[0].Result.Csr.Designation == null) {
              var rank = "Unranked";
              var rankNumber = 0;
              var rankPercent = "";
              var tier = "";
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = 0;
            } else {
              var ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Onyx", "Champion"];
              var rankNumber = parsedData.Results[0].Result.Csr.Designation;
              var rank = ranks[rankNumber-1];
              var rankPercentNumber = parsedData.Results[0].Result.Csr.PercentToNextTier;
              if(rankPercentNumber != 0) {
                var rankPercent = " (" + rankPercentNumber + "%)";
              } else {
                  var rankPercent = "";
              }
              var tier = " ";
              if(rank == "Champion") {
                tier += parsedData.Results[0].Result.Csr.Rank;
              } else if(rank != "Onyx") {
                tier += parsedData.Results[0].Result.Csr.Tier;
              }
              var mmr = parsedData.Results[0].Result.Mmr.Rating;
              var csr = parsedData.Results[0].Result.Csr.Raw;
            }

            //create message
            var message = "Rank: "+ rank + tier + rankPercent +"\n";
            message += "Raw CSR: "+ csr +"\n";
            message += "MMR: "+ mmr +"\n";
            message += "Time played: "+ timePlayed +"\n";
            message += "Games played: "+ gamesPlayed +"\n";
            message += "Games won: "+ gamesWon +"\n";
            message += "Games lost: "+ gamesLost +"\n";
            message += "Win percentage: "+ winPercent +"%\n";
            message += "Favorite leader: "+ favoriteLeader;

            //check if bot has permission to embed links
            if(!eventVariables.guild.me.permissionsIn(eventVariables.channel).has("EMBED_LINKS")) {
              //send error message for no permissions
              eventVariables.channel.send(util.format("<@!%s>, make sure that I have the permissions to embed links.", eventVariables.userID));
              return(1);
            }

            //send embedded message with stats
            eventVariables.channel.send({ embed: {
              author: {
                name: "Ranked Stats for " + gamertag
              },
              color: eventVariables.embedcolor,
              thumbnail: {
                url: "attachment://designation.png",
                height: 1920 * .01,
                width: 1452 * .01
              },
              fields: [
                {
                  name: "Xbox 3v3 War",
                  value: message,
                  inline: true
                }
              ]

            }, files: [
              {
                attachment: util.format("./assets/designations/%s.png", rankNumber),
                name: "designation.png"
              }
            ]});
          });
        });
      }
    });
  });
}

module.exports.get1X = get1X;
module.exports.get3X = get3X;
module.exports.get2 = get2;
module.exports.get3 = get3;