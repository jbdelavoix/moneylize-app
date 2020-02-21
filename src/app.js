const {
  app,
  dialog,
  ipcMain,
  BrowserWindow,
  Menu
} = require("electron")

const fs = require("fs")


let mainWindow = null

app.on("window-all-closed", function () {
  if (process.platform != "darwin")
    app.quit()
  app.quit()
})

let template = [{
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
]

menu = Menu.buildFromTemplate(template)

function createWindow() {

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: true
    },
    frame: false
  })

  mainWindow.loadURL("https://moneylize.com")

  ipcMain.on("file:open", function (event) {
    dialog.showOpenDialog((filenames) => {
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
      }, (filepath) => {
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

  if (process.platform == "darwin")
    app.on("activate-with-no-open-windows", function () {
      mainWindow.show()
    })

  Menu.setApplicationMenu(menu)

  mainWindow.on("close", function () {
    if (process.platform != "darwin") {
      mainWindow = null
    } else {
      mainWindow = null
    }
  })
}

app.on("ready", createWindow)
