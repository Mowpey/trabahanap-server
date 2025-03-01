export const getHome = (req, res) => {
  res.send("Controller is working from home!")
}

export const anotherGetHome = (req, res) => {
  console.log("Another route")
  res.send("Post Request from Home!")
}




