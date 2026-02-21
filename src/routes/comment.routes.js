import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware";
import { 
    addComment, 
    deleteComment, 
    getVideoComments, 
    updateComment 
} from "../controllers/comment.controller";

const router = Router;
router.use(verifyJWT);

router.routes("/:videoId").get(getVideoComments).post(addComment);
router.routes("/c/:commentId").patch(updateComment).delete(deleteComment);

export default router;