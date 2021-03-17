const {
  ipcRenderer,
} = require("electron")


window.addEventListener("contextmenu", (e) => {
  e.preventDefault()
  ipcRenderer.send("contextmenu:open", e.x, e.y)
}, false)