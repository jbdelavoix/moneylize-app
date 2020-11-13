const {
  app,
  dialog,
  ipcMain,
  session,
  BrowserWindow,
  Menu,
} = require("electron")
const fs = require("fs")
const path = require("path")


function addMenu(platform) {
  let menu = Menu.buildFromTemplate([{
      label: "Home",
      submenu: [{
          role: "about"
        },
        {
          type: "separator"
        },
        {
          label: "Services",
          submenu: []
        },
        {
          type: "separator"
        },
        {
          role: "hide"
        },
        {
          role: "hideOthers"
        },
        {
          role: "unhide"
        },
        {
          type: "separator"
        },
        {
          role: "quit"
        },
      ]
    },
    {
      label: "Edit",
      submenu: [{
          role: "undo"
        },
        {
          role: "redo"
        },
        {
          type: "separator"
        },
        {
          role: "cut"
        },
        {
          role: "copy"
        },
        {
          role: "paste"
        }
      ]
    }, {
      label: "View",
      submenu: [{
          role: "reload"
        },
        {
          role: "toggledevtools"
        },
        {
          type: "separator"
        },
        {
          role: "resetzoom"
        },
        {
          role: "zoomin"
        },
        {
          role: "zoomout"
        },
        {
          type: "separator"
        },
        {
          role: "togglefullscreen"
        }
      ]
    }, {
      role: "window",
      submenu: [{
          role: "minimize"
        },
        {
          role: "close"
        }
      ]
    }, {
      role: "help",
      submenu: [{
        label: "Learn More"
      }]
    }
  ])

  if (platform == "darwin") {
    Menu.setApplicationMenu(menu)
  } else {
    Menu.setApplicationMenu(null)
  }
}


function createWindow() {

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    titleBarStyle: "hiddenInset",
    icon: path.join(__dirname, "../build/icons/icon.png"),
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js")
    },
    frame: false
  })
  
  // Load the app
  mainWindow.loadURL("https://moneylize.com")

  // On ipcEvent...
  ipcMain.on("contextmenu:open", function (event, x, y) {
    let contextmenu = Menu.buildFromTemplate([{
        role: "undo"
      },
      {
        role: "redo"
      },
      {
        type: "separator"
      },
      {
        role: "cut"
      },
      {
        role: "copy"
      },
      {
        role: "paste"
      },
      {
        type: "separator"
      },
      {
        label: "Advanced",
        submenu: [{
            role: "reload"
          },
          {
            role: "toggledevtools"
          },
        ]
      }
    ])
    contextmenu.popup({
      window: mainWindow,
      x,
      y
    })
  })

  ipcMain.on("file:open", function (event) {
    dialog.showOpenDialog(mainWindow).then(result => {
      let filenames = result.filePaths
      if (!filenames || !filenames.length)
        return event.sender.send("file:open-no-filename")
      var filepath = filenames[0]
      fs.readFile(filepath, (err, data) => {
        if (err)
          return event.sender.send("file:open-error", filepath)
        return event.sender.send("file:open-success", {
          filepath: filepath,
          data: data
        })
      })
    })
  })

  ipcMain.on("file:save", function (event, file) {
    save = (filepath) => {
      fs.writeFile(filepath, file.data, (err) => {
        if (err)
          return event.sender.send("file:save-error", filepath)
        return event.sender.send("file:save-success", filepath)
      })
    }

    fs.exists(file.filepath, (exists) => {
      if (exists) save(file.filepath)
      else dialog.showSaveDialog({
        defaultPath: "*/" + file.filename
      }).then((result) => {
        let filepath = result.filePath
        if (!filepath)
          return event.sender.send("file:save-error", filepath)
        if (!filepath.endsWith(".mnyl")) filepath = filepath + ".mnyl"
        return save(filepath)
      })
    })
  })

  ipcMain.on("app:minimize", function () {
    mainWindow.minimize()
  })

  ipcMain.on("app:maximize", function () {
    mainWindow.maximize()
  })

  ipcMain.on("app:unmaximize", function () {
    mainWindow.unmaximize()
  })

  ipcMain.on("app:close", function () {
    mainWindow.close()
  })

  if (process.platform == "darwin") {
    app.on("activate-with-no-open-windows", function () {
      mainWindow.show()
    })
  }

  // Emitted when the window is closed.
  mainWindow.on("close", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    if (process.platform != "darwin") {
      mainWindow = null
    } else {
      mainWindow.hide()
    }
  })
}


// Keep a global reference of the window object, if you don"t, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow = null

// Add menu
addMenu(process.platform)

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  app.quit()
})

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on("ready", createWindow)