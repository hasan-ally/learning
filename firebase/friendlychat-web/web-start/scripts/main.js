/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// Initializes FriendlyChat.
function FriendlyChat() {
  this.checkSetup();

  // Shortcuts to DOM Elements.
  this.messageList = document.getElementById('messages');
  this.messageForm = document.getElementById('message-form');
  this.messageInput = document.getElementById('message');
  this.submitButton = document.getElementById('submit');
  this.submitImageButton = document.getElementById('submitImage');
  this.imageForm = document.getElementById('image-form');
  this.mediaCapture = document.getElementById('mediaCapture');
  this.userPic = document.getElementById('user-pic');
  this.userName = document.getElementById('user-name');
  this.signInButton = document.getElementById('sign-in');
  this.signOutButton = document.getElementById('sign-out');
  this.signInSnackbar = document.getElementById('must-signin-snackbar');

  // Saves message on form submit.
  this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
  this.signOutButton.addEventListener('click', this.signOut.bind(this));
  this.signInButton.addEventListener('click', this.signIn.bind(this));

  // Toggle for the button.
  var buttonTogglingHandler = this.toggleButton.bind(this);
  this.messageInput.addEventListener('keyup', buttonTogglingHandler);
  this.messageInput.addEventListener('change', buttonTogglingHandler);

  // Events for image upload.
  this.submitImageButton.addEventListener('click', function (e) {
    e.preventDefault();
    this.mediaCapture.click();
  }.bind(this));
  this.mediaCapture.addEventListener('change', this.saveImageMessage.bind(this));

  this.initFirebase();
}

// Sets up shortcuts to Firebase features and initiate firebase auth.
FriendlyChat.prototype.initFirebase = function () {
  // TODO(DEVELOPER): Initialize Firebase.
  this.auth = firebase.auth();
  this.database = firebase.database();
  this.storage = firebase.storage();
  // Initializes the firebase auth and listens to auth state change
  this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

// Loads chat messages history and listens for upcoming ones.
FriendlyChat.prototype.loadMessages = function () {
  // TODO(DEVELOPER): Load and listens for new messages.
  // Refer /messages/ in database
  this.messagesRef = this.database.ref('messages');

  // Remove all previous listeners
  this.messagesRef.off();

  var setMessage = function (data) {
    var val = data.val();
    this.displayMessage(data.key, val.name, val.text, val.photoURL, val.imageUrl);
  }.bind(this);
  this.messagesRef.limitToLast(12).on('child_added', setMessage);
  this.messagesRef.limitToLast(12).on("child_changed", setMessage);
};

// Saves a new message on the Firebase DB.
FriendlyChat.prototype.saveMessage = function (e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.
  if (this.messageInput.value && this.checkSignedInWithMessage()) {
    var currentUser = this.auth.currentUser;
    // Add a new message entry to Firebase database
    this.messagesRef.push({
      name: currentUser.displayName,
      text: this.messageInput.value,
      photoURL: currentUser.photoURL || 'images/profile_placeholder.png'
    }).then(function () {
      // Clear the messageInput field and send button state
      FriendlyChat.resetMaterialTextfield(this.messageInput);
      this.toggleButton();
    }.bind(this)).catch(function (error) {
      console.error('Error writing message to firebase', error);
    });
  }
};

// Sets the URL of the given img element with the URL of the image stored in Cloud Storage.
FriendlyChat.prototype.setImageUrl = function (imageUri, imgElement) {
  // TODO(DEVELOPER): If image is on Cloud Storage, fetch image URL and set img element's src.
  if (imageUri.startsWith('gs://')) {
    imgElement.src = FriendlyChat.LOADING_IMAGE_URL;
    this.storage.refFromURL(imageUri).getMetadata().then(function (metadata) {
      imgElement.src = metadata.downloadURLs[0];
    });
  } else {
    imgElement.src = imageUri;
  }
};

// Saves a new message containing an image URI in Firebase.
// This first saves the image in Firebase storage.
FriendlyChat.prototype.saveImageMessage = function (event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  this.imageForm.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (this.checkSignedInWithMessage()) {

    // TODO(DEVELOPER): Upload image to Firebase storage and add message.
    // Display a loading image until image is uploaded to cloud storage
    var currentUser = this.auth.currentUser;
    this.messagesRef.push({
        name: currentUser.displayName,
        imageUrl: FriendlyChat.LOADING_IMAGE_URL,
        photoURL: currentUser.photoURL || "/images/profile_placeholder.png"
      })
      .then(function (data) {
        // Upload to cloud storage
        var filePath = currentUser.uid + "/" + data.key + "/" + file.name;
        return this.storage
          .ref(filePath)
          .put(file)
          .then(function (snapshot) {
            // Get the file's storage URI and update the message imageUrl
            var fullPath = snapshot.metadata.fullPath;
            console.log(fullPath, this.storage
              .ref(fullPath)
              .toString());
            return data.update({
              imageUrl: this.storage.ref(fullPath).toString()
            });
          }.bind(this));
      }.bind(this))
      .catch(function (error) {
        console.error("Error uploading file to cloud storage", error);
      });
  }
};

// Signs-in Friendly Chat.
FriendlyChat.prototype.signIn = function () {
  // TODO(DEVELOPER): Sign in Firebase with credential from the Google user.
  var provider = new firebase.auth.GoogleAuthProvider();
  this.auth.signInWithPopup(provider);
};

// Signs-out of Friendly Chat.
FriendlyChat.prototype.signOut = function () {
  // TODO(DEVELOPER): Sign out of Firebase.
  this.auth.signOut();
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
FriendlyChat.prototype.onAuthStateChanged = function (user) {
  if (user) { // User is signed in!
    // Get profile pic and user's name from the Firebase user object.
    var profilePicUrl = user.photoURL; // TODO(DEVELOPER): Get profile pic.
    var userName = user.displayName; // TODO(DEVELOPER): Get user's name.

    // Set the user's profile pic and name.
    this.userPic.style.backgroundImage = 'url(' + profilePicUrl + ')';
    this.userName.textContent = userName;

    // Show user's profile and sign-out button.
    this.userName.removeAttribute('hidden');
    this.userPic.removeAttribute('hidden');
    this.signOutButton.removeAttribute('hidden');

    // Hide sign-in button.
    this.signInButton.setAttribute('hidden', 'true');

    // We load currently existing chant messages.
    this.loadMessages();

    // We save the Firebase Messaging Device token and enable notifications.
    this.saveMessagingDeviceToken();
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    this.userName.setAttribute('hidden', 'true');
    this.userPic.setAttribute('hidden', 'true');
    this.signOutButton.setAttribute('hidden', 'true');

    // Show sign-in button.
    this.signInButton.removeAttribute('hidden');
  }
};

// Returns true if user is signed-in. Otherwise false and displays a message.
FriendlyChat.prototype.checkSignedInWithMessage = function () {
  /* TODO(DEVELOPER): Check if user is signed-in Firebase. */
  if (this.auth.currentUser) {
    return true;
  }

  // Display a message to the user using a Toast.
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
  return false;
};

// Saves the messaging device token to the datastore.
FriendlyChat.prototype.saveMessagingDeviceToken = function () {
  // TODO(DEVELOPER): Save the device token in the realtime datastore
  firebase.messaging().getToken().then(function(currentToken){
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      firebase.database().ref('/fcmTokens').child(currentToken).set(firebase.auth().currentUser.uid);
    } else {
      this.requestNotificationsPermissions();
    }
  }.bind(this)).catch(function(error) {
    console.log('Unable to get token', error);
  });
};

// Requests permissions to show notifications.
FriendlyChat.prototype.requestNotificationsPermissions = function () {
  // TODO(DEVELOPER): Request permissions to send notifications.
  console.log('Requesting permissions');
  firebase.messaging().requestPermission().then(function(){
    this.saveMessagingDeviceToken();
  }.bind(this)).catch(function(error){
    console.error('Unable to get permission to notify', error);
  })

};

// Resets the given MaterialTextField.
FriendlyChat.resetMaterialTextfield = function (element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
};

// Template for messages.
FriendlyChat.MESSAGE_TEMPLATE =
  '<div class="message-container">' +
  '<div class="spacing"><div class="pic"></div></div>' +
  '<div class="message"></div>' +
  '<div class="name"></div>' +
  '</div>';

// A loading image URL.
FriendlyChat.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

// Displays a Message in the UI.
FriendlyChat.prototype.displayMessage = function (key, name, text, picUrl, imageUri) {
  var div = document.getElementById(key);
  // If an element for that message does not exists yet we create it.
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = FriendlyChat.MESSAGE_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', key);
    this.messageList.appendChild(div);
  }
  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
  }
  div.querySelector('.name').textContent = name;
  var messageElement = div.querySelector('.message');
  if (text) { // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } else if (imageUri) { // If the message is an image.
    var image = document.createElement('img');
    image.addEventListener('load', function () {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }.bind(this));
    this.setImageUrl(imageUri, image);
    messageElement.innerHTML = '';
    messageElement.appendChild(image);
  }
  // Show the card fading-in.
  setTimeout(function () {
    div.classList.add('visible')
  }, 1);
  this.messageList.scrollTop = this.messageList.scrollHeight;
  this.messageInput.focus();
};

// Enables or disables the submit button depending on the values of the input
// fields.
FriendlyChat.prototype.toggleButton = function () {
  if (this.messageInput.value) {
    this.submitButton.removeAttribute('disabled');
  } else {
    this.submitButton.setAttribute('disabled', 'true');
  }
};

// Checks that the Firebase SDK has been correctly setup and configured.
FriendlyChat.prototype.checkSetup = function () {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
      'Make sure you go through the codelab setup instructions and make ' +
      'sure you are running the codelab using `firebase serve`');
  }
};

window.onload = function () {
  window.friendlyChat = new FriendlyChat();
};