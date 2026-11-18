import { app } from "./app.js";
import { seedIfEmpty } from "./seed.js";

seedIfEmpty();
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`TutoresOn-Line API escuchando en http://localhost:${port}`));
