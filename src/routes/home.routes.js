import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware";
import { getHomeFeed } from "../controllers/home.controller";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getHomeFeed);

export default router;