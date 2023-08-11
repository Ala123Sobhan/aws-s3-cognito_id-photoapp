/* 
ABOUT THIS CODE: This example works with the AWS SDK for JavaScript version 3 (v3),
which is available at https://github.com/aws/aws-sdk-js-v3. 
Purpose:
PhotoApp.js demonstrates how to manipulate photos in albums stored in an Amazon S3 bucket.
Inputs (replace in code as per your AWS environment):
- BUCKET_NAME
- REGION
- IDENTITY_POOL_ID
Running the code:
node PhotoApp.ts
*/

// declare global {
//   interface Window {
//     getHTML: any, // 👈️ turn off type checking
//     listAlbums: any,
//     createAlbum: any,
//     viewAlbum: any,
//     addPhoto: any,
//     deletePhoto: any,
//     deleteAlbum: any,
//   }
// }

// Load the required clients and packages
const { CognitoIdentityClient } = require("@aws-sdk/client-cognito-identity");
const {
  fromCognitoIdentityPool,
} = require("@aws-sdk/credential-provider-cognito-identity");
const { S3Client, PutObjectCommand, ListObjectsCommand, DeleteObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

// Set the AWS Region
const REGION = "us-east-1"; //REGION

// Initialize the Amazon Cognito credentials provider
const s3 = new S3Client({
  region: REGION,
  credentials: fromCognitoIdentityPool({
    client: new CognitoIdentityClient({ region: REGION }),
    identityPoolId: "us-east-1:f6ff1d3f-4c53-403f-8f56-a05b031d2013", // IDENTITY_POOL_ID
  }),
});

const albumBucketName = "photoalbums-12123"; //BUCKET_NAME

// A utility function to create HTML
const getHtml = function(template: string[]): string {
  return template.join("\n");
}
// Make getHTML function available to the browser
//window.getHTML = getHtml;

// List the photo albums that exist in the bucket
const listAlbums = async () => {
  try {
    const data = await s3.send(
        new ListObjectsCommand({ Delimiter: "/", Bucket: albumBucketName })
    );

    if (data.CommonPrefixes === undefined) {
      const htmlTemplate = [
        "<p>You don't have any albums. You need to create an album.</p>",
        "<button onclick=\"window.jsNamespace.createAlbum(prompt('Enter album name:'))\">",
        "Create new album",
        "</button>",
      ];
      document.getElementById("app").innerHTML = getHtml(htmlTemplate);
    } else {
      var albums = data.CommonPrefixes.map(function (commonPrefix: any) {
        var prefix = commonPrefix.Prefix;
        var albumName = decodeURIComponent(prefix.replace("/", ""));
        return getHtml([
          "<li>",
          "<span style=\"color:red\" onclick=\"window.jsNamespace.deleteAlbum('" + albumName + "')\">X</span>",
          "<span onclick=\"window.jsNamespace.viewAlbum('" + albumName + "')\">",
          albumName,
          "</span>",
          "</li>",
        ]);
      });
      var message = albums.length
          ? getHtml([
            "<p>Click an album name to view it.</p>",
            "<p>Click the X to delete the album.</p>",
          ])
          : "<p>You do not have any albums. You need to create an album.";
      const htmlTemplate = [
        "<h2>Albums</h2>",
        message,
        "<ul>",
        getHtml(albums),
        "</ul>",
        "<button onclick=\"window.jsNamespace.createAlbum(prompt('Enter Album Name:'))\">",
        "Create new Album",
        "</button>",
      ];
      document.getElementById("app").innerHTML = getHtml(htmlTemplate);
    }
  } catch (err) {
    return alert("There was an error listing your albums: " + err.message);
  }
};

// Make listAlbums function available to the browser
//window.listAlbums = listAlbums;

// Create an album in the bucket
const createAlbum = async (albumName: string) => {
  albumName = albumName.trim();
  if (!albumName) {
    return alert("Album names must contain at least one non-space character.");
  }
  if (albumName.indexOf("/") !== -1) {
    return alert("Album names cannot contain slashes.");
  }
  var albumKey = encodeURIComponent(albumName);
  try {
    const key = albumKey + "/";
    const params = { Bucket: albumBucketName, Key: key };
    const data = await s3.send(new PutObjectCommand(params));
    alert("Successfully created album.");//innerHTML
    viewAlbum(albumName);
  } catch (err) {
    return alert("There was an error creating your album: " + err.message);
  }
};

// Make createAlbum function available to the browser
//window.createAlbum = createAlbum;

// View the contents of an album

const viewAlbum = async (albumName: string) => {
  const albumPhotosKey = encodeURIComponent(albumName) + "/";
  try {
    let data = await s3.send(
        new ListObjectsCommand({
          Prefix: albumPhotosKey,
          Bucket: albumBucketName,
        })
    );
    if (data.Contents.length === 1) {
      var htmlTemplate = [
        "<p>You don't have any photos in this album named <b>" + albumName + "</b>. You need to add photos.</p>",
        "<p>First browse a photo to select it. Then click Add Photo to add photo to the album.</p>",
        "<br/>",
        '<input id="photoupload" type="file" accept="image/*">',
        '<button id="addphoto" onclick="window.jsNamespace.addPhoto(\'' + albumName + "')\">",
        "Add photo",
        "</button>",
        '<button onclick="window.jsNamespace.listAlbums()">',
        "Back to albums",
        "</button>",
      ];
      document.getElementById("app").innerHTML = getHtml(htmlTemplate);
    } else {
      const href = "https://s3." + REGION + ".amazonaws.com/";
      const bucketUrl = href + albumBucketName + "/";
      if (data.Contents && data.Contents.length && data.Contents.length > 0) {
        data.Contents.shift(); // remove first element as it is folder name returned on first element.
      }
      console.log(JSON.stringify(data));
      const photos = data.Contents.map(function (photo: any) {
        const photoKey = photo.Key;
        console.log(photoKey);
        const photoUrl = bucketUrl + encodeURIComponent(photoKey);
        console.log(photoUrl);
        return getHtml([
          "<span>",
          "<div>",
          '<img style="width:128px;height:128px;" src="' + photoUrl + '"/>',
          "</div>",
          "<div>",
          "<span style=\"color:red\" onclick=\"window.jsNamespace.deletePhoto('" +
          albumName +
          "','" +
          photoKey +
          "')\">",
          "X",
          "</span>",
          "<span>",
          photoKey.replace(albumPhotosKey, ""),
          "</span>",
          "</div>",
          "</span>",
          "<br/>",
        ]);
      });
      var message = photos.length
          ? "<p>Click the X to delete the photo.</p>"
          : "<p>You don't have any photos in this album named <b>" + albumName + "</b>. You need to add photos.</p>";
      const htmlTemplate = [
        "<h2>",
        "Album: " + albumName,
        "</h2>",
        message,
        "<div>",
        getHtml(photos),
        "</div>",
        "<br/>",
        '<input id="photoupload" type="file" accept="image/*">',
        '<button id="addphoto" onclick="window.jsNamespace.addPhoto(\'' + albumName + "')\">",
        "Add photo",
        "</button>",
        '<button onclick="window.jsNamespace.listAlbums()">',
        "Back to albums",
        "</button>",
      ];
      document.getElementById("app").innerHTML = getHtml(htmlTemplate);
    }
  } catch (err) {
    return alert("There was an error viewing your album: " + err.message);
  }
};
// Make viewAlbum function available to the browser
//window.viewAlbum = viewAlbum;

// Add a photo to an album
const addPhoto = async (albumName: string) => {
  const files = (document.getElementById("photoupload") as HTMLInputElement).files;
  try {
    const albumPhotosKey = encodeURIComponent(albumName) + "/";
    const data = await s3.send(
        new ListObjectsCommand({
          Prefix: albumPhotosKey,
          Bucket: albumBucketName
        })
    );
    const file = files[0];
    const fileName = file.name;
    const photoKey = albumPhotosKey + fileName;
    const uploadParams = {
      Bucket: albumBucketName,
      Key: photoKey,
      Body: file
    };
    try {
      const data = await s3.send(new PutObjectCommand(uploadParams));
      alert("Successfully uploaded photo.");
      viewAlbum(albumName);
    } catch (err) {
      return alert("There was an error uploading your photo: " + err.message);
    }
  } catch (err) {
    if (!files.length) {
      return alert("Choose a file to upload first.");
    }
  }
};
// Make addPhoto function available to the browser
//window.addPhoto = addPhoto;

// Delete a photo from an album
const deletePhoto = async (albumName: string, photoKey: string) => {
  try {
    console.log(photoKey);
    const params = { Key: photoKey, Bucket: albumBucketName };
    const data = await s3.send(new DeleteObjectCommand(params));
    console.log("Successfully deleted photo.");
    viewAlbum(albumName);
  } catch (err) {
    return alert("There was an error deleting your photo: " + err.message);
  }
};
// Make deletePhoto function available to the browser
//window.deletePhoto = deletePhoto;

// Delete an album from the bucket
const deleteAlbum = async (albumName: string) => {
  const albumKey = encodeURIComponent(albumName) + "/";
  try {
    const params = { Bucket: albumBucketName, Prefix: albumKey };
    const data = await s3.send(new ListObjectsCommand(params));
    const objects = data.Contents.map(function (object: any) {
      return { Key: object.Key };
    });
    try {
      const params = {
        Bucket: albumBucketName,
        Delete: { Objects: objects },
        Quiet: true,
      };
      const data = await s3.send(new DeleteObjectsCommand(params));
      listAlbums();
      return alert("Successfully deleted album.");
    } catch (err) {
      return alert("There was an error deleting your album: " + err.message);
    }
  } catch (err) {
    return alert("There was an error deleting your album1: " + err.message);
  }
};
// Make deleteAlbum function available to the browser
//window.deleteAlbum = deleteAlbum;

export {  
  getHtml,
  listAlbums,
  createAlbum,
  viewAlbum,
  addPhoto,
  deletePhoto,
  deleteAlbum
};