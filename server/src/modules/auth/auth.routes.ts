import { Router } from "express";
import { signupUser } from "./auth.service";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: "Email, username, and password are required" });
    }

    const user = await signupUser(email, username, password);
    res.status(201).json({ user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;