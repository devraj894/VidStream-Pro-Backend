import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { publishAVideo } from "../controllers/video.contoller.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();
router.use(verifyJWT);

router.route("/publish-video").post(
    upload.fields([
        {
            name: "videoFile",
            maxCount: 1
        },
        {
            name: "thumbnail",
            maxCount: 1
        }
    ]),
    publishAVideo
)

export default router;