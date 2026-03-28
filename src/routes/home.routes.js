import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { getHomeFeed } from "../controllers/home.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getHomeFeed);

export default router;