var fs = require('fs');
var path = require('path');
var prompt = require('prompt');

// Default settings for using ios and android with Firebase
var usingiOS = false, usingAndroid = false;

// The directories where the Podfile and include.gradle are stored
var directories = {
    ios: './platforms/ios',
    android: './platforms/android'
};

console.log('NativeScript Firebase Plugin Installation');

var appRoot = require('app-root-path').toString();
var pluginConfigPath = path.join(appRoot, "firebase.nativescript.json");

var config = {};
function mergeConfig(result) {
    for (var key in result) {
        config[key] = isSelected(result[key]);
    }
}
function saveConfig() {
    fs.writeFileSync(pluginConfigPath, JSON.stringify(config, null, 4));
}
function readConfig() {
    try {
        config = JSON.parse(fs.readFileSync(pluginConfigPath));
    } catch(e) {
        console.log("Failed reading config at " + pluginConfigPath);
        console.log(e);
        config = {};
    }
}

if (process.argv.indexOf("config") == -1 && fs.existsSync(pluginConfigPath)) {
    readConfig();
    console.log("Config exists at: " + pluginConfigPath);
    askiOSPromptResult(config);
    askAndroidPromptResult(config);
    promptQuestionsResult(config);
} else {
    console.log("No existing config at: " + pluginConfigPath);
    prompt.start();
    askiOSPrompt();
}

/**
 * Prompt the user if they are integrating Firebase with iOS
 */
function askiOSPrompt() {
    prompt.get({
        name: 'using_ios',
        description: 'Are you using iOS (y/n)',
        default: 'y'
    }, function (err, result) {
        if (err) {
            return console.log(err);
        }
        mergeConfig(result);
        askiOSPromptResult(result);
        askAndroidPrompt();
    });
}
function askiOSPromptResult(result) {
    if (isSelected(result.using_ios)) {
        usingiOS = true;
    }
}

/**
 * Prompt the user if they are integrating Firebase with Android
 */
function askAndroidPrompt() {
    prompt.get({
        name: 'using_android',
        description: 'Are you using Android (y/n)',
        default: 'y'
    }, function (err, result) {
        if (err) {
            return console.log(err);
        }
        mergeConfig(result);
        askAndroidPromptResult(result);
        if (usingiOS || usingAndroid) {
            promptQuestions();
        } else {
            askSaveConfigPrompt();
        }
    });
}
function askAndroidPromptResult(result) {
    if (isSelected(result.using_android)) {
        usingAndroid = true;
    }
}

/**
 * Prompt the user through the configurable Firebase add-on services
 */
function promptQuestions() {
    prompt.get([{
        name: 'remote_config',
        description: 'Are you using Firebase RemoteConfig (y/n)',
        default: 'n'
    }, {
        name: 'messaging',
        description: 'Are you using Firebase Messaging (y/n)',
        default: 'n'
    }, {
        name: 'storage',
        description: 'Are you using Firebase Storage (y/n)',
        default: 'n'
    }, {
        name: 'facebook_auth',
        description: 'Are you using Firebase Facebook Authentication (y/n)',
        default: 'n'
    }, {
        name: 'google_auth',
        description: 'Are you using Firebase Google Authentication (y/n)',
        default: 'n'
    }], function (err, result) {
        if (err) {
            return console.log(err);
        }
        mergeConfig(result);
        promptQuestionsResult(result);
        askSaveConfigPrompt();
    });
}
function promptQuestionsResult(result) {
    if(usingiOS) {
        writePodFile(result);
    }
    if(usingAndroid) {
        writeGradleFile(result);
        writeGoogleServiceCopyHook();
    }
    console.log('Firebase post install completed. To re-run this script, navigate to the root directory of `nativescript-plugin-firebase` in your `node_modules` folder and run: `npm run config`.');
}

function askSaveConfigPrompt() {
    prompt.get({
        name: 'save_config',
        description: 'Do you want to save the selected configuration. Reinstalling the dependency will reuse the setup from: ' + pluginConfigPath + '. CI will be easier. (y/n)',
        default: 'y'
    }, function (err, result) {
        if (err) {
            return console.log(err);
        }
        if (isSelected(result.save_config)) {
            saveConfig();
        }
    });
}

/**
 * Create the iOS PodFile for installing the Firebase iOS dependencies and service dependencies
 *
 * @param {any} result The answers to the micro-service prompts
 */
function writePodFile(result) {
    if(!fs.existsSync(directories.ios)) {
        fs.mkdirSync(directories.ios);
    }
    try {
        fs.writeFileSync(directories.ios + '/Podfile',
`pod 'Firebase', '~> 3.9.0'
pod 'Firebase/Database'
pod 'Firebase/Auth'
pod 'Firebase/Crash'

# Uncomment if you want to enable Remote Config
` + (isSelected(result.remote_config) ? `` : `#`) + `pod 'Firebase/RemoteConfig'

# Uncomment if you want to enable FCM (Firebase Cloud Messaging)
` + (isSelected(result.messaging) ? `` : `#`) + `pod 'Firebase/Messaging'

# Uncomment if you want to enable Firebase Storage
` + (isSelected(result.storage) ? `` : `#`) + `pod 'Firebase/Storage'

# Uncomment if you want to enable Facebook Authentication
` + (isSelected(result.facebook_auth) ? `` : `#`) + `pod 'FBSDKCoreKit'
` + (isSelected(result.facebook_auth) ? `` : `#`) + `pod 'FBSDKLoginKit'

# Uncomment if you want to enable Google Authentication
` + (isSelected(result.google_auth) ? `` : `#`) + `pod 'GoogleSignIn'`);
        console.log('Successfully created iOS (Pod) file.');
    } catch(e) {
        console.log('Failed to create iOS (Pod) file.');
        console.log(e);
    }
}

/**
 * Create the Android Gradle for installing the Firebase Android dependencies and service dependencies
 *
 * @param {any} result The answers to the micro-service prompts
 */
function writeGradleFile(result) {
     if(!fs.existsSync(directories.android)) {
        fs.mkdirSync(directories.android);
    }
    try {
        fs.writeFileSync(directories.android + '/include.gradle',
`
android {
    productFlavors {
        "fireb" {
            dimension "fireb"
        }
    }
}

repositories {
    jcenter()
    mavenCentral()
}

dependencies {
    // make sure you have these versions by updating your local Android SDK's (Android Support repo and Google repo)
    compile "com.google.firebase:firebase-core:9.8.+"
    compile "com.google.firebase:firebase-database:9.8.+"
    compile "com.google.firebase:firebase-auth:9.8.+"
    compile "com.google.firebase:firebase-crash:9.8.+"

    // for reading google-services.json and configuration
    def googlePlayServicesVersion = project.hasProperty('googlePlayServicesVersion') ? project.googlePlayServicesVersion : '9.8.+'
    compile "com.google.android.gms:play-services-base:$googlePlayServicesVersion"

    // Uncomment if you want to use 'Remote Config'
    ` + (isSelected(result.remote_config) ? `` : `//`) + ` compile "com.google.firebase:firebase-config:9.8.+"

    // Uncomment if you want FCM (Firebase Cloud Messaging)
    ` + (isSelected(result.messaging) ? `` : `//`) + ` compile "com.google.firebase:firebase-messaging:9.8.+"

    // Uncomment if you want Google Cloud Storage
    ` + (isSelected(result.storage) ? `` : `//`) + ` compile 'com.google.firebase:firebase-storage:9.8.+'

    // Uncomment if you need Facebook Authentication
    ` + (isSelected(result.facebook_auth) ? `` : `//`) + ` compile "com.facebook.android:facebook-android-sdk:4.+"

    // Uncomment if you need Google Sign-In Authentication
    ` + (isSelected(result.google_auth) ? `` : `//`) + ` compile "com.google.android.gms:play-services-auth:9.8.+"

}

apply plugin: "com.google.gms.google-services"
`);
        console.log('Successfully created Android (include.gradle) file.');
    } catch(e) {
        console.log('Failed to create Android (include.gradle) file.');
        console.log(e);
    }
}

/**
 * Installs an after-prepare build hook to copy the app/App_Resources/Android/google-services.json to platform/android on build.
 */
function writeGoogleServiceCopyHook() {
    console.log("Install google-service.json copy hook.");
    try {
        var scriptContent =
`
var path = require("path");
var fs = require("fs");

module.exports = function() {

    var sourceGoogleJson = path.join(__dirname, "..", "..", "app", "App_Resources", "Android", "google-services.json");
    var destinationGoogleJson = path.join(__dirname, "..", "..", "platforms", "android", "google-services.json");
    if (fs.existsSync(sourceGoogleJson) && fs.existsSync(path.dirname(destinationGoogleJson))) {
        console.log("Copy " + sourceGoogleJson + " to " + destinationGoogleJson + ".");
        fs.writeFileSync(destinationGoogleJson, fs.readFileSync(sourceGoogleJson));
    }
};
`;
        var scriptPath = path.join(appRoot, "hooks", "after-prepare", "firebase-copy-google-services.js");
        var afterPrepareDirPath = path.dirname(scriptPath);
        var hooksDirPath = path.dirname(afterPrepareDirPath);
        if (!fs.existsSync(afterPrepareDirPath)) {
            if (!fs.existsSync(hooksDirPath)) {
                fs.mkdirSync(hooksDirPath);
            }
            fs.mkdirSync(afterPrepareDirPath);
        }
        fs.writeFileSync(scriptPath, scriptContent);
    } catch(e) {
        console.log("Failed to install google-service.json copy hook.");
        console.log(e);
    }
}

/**
 * Determines if the answer validates as selected
 *
 * @param {any} value The user input for a prompt
 * @returns {boolean} The answer is yes, {false} The answer is no
 */
function isSelected(value) {
    return value === true || (typeof value === "string" && value.toLowerCase() === 'y');
}
