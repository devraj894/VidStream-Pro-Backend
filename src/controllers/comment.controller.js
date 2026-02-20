import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { Video } from "../models/video.model";
import { Comment } from "../models/comment.model";
import { ApiResponse } from "../utils/ApiResponse";

const getVideoComments = asyncHandler(async (req, res) => {
    // get data (video id and queries)
    const {videoId} = req.params;
    const {page = 1, limit = 10} = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // validate data
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid video id");
    }

    // aggregation piplines
    const aggregate = Comment.aggregate([
        // filter comments based on video
        {
            $match: {
                video: mongoose.Types.ObjectId(videoId)
            }
        },
        // apply sorting to newest first based
        { 
            $sort: {
                createdAt: -1 
            } 
        },
        // lookup in users to get avatar, username and fullName
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerInfo",
                pipeline: [
                    {
                        $project: {
                            avatar: 1,
                            username: 1,
                            fullName: 1
                        }
                    }
                ]
            }
        },
        // converted array into object
        {
            $unwind: "$ownerInfo"
        },
    ])

    // pagination options
    const options = {
        page: pageNumber,
        limit: limitNumber
    }

    const comments = await Comment.aggregatePaginate(aggregate, options);

    // return
    return res.status(200).json(
        new ApiResponse(200, comments, "Comments fetched successfully")
    )
})

const addComment = asyncHandler(async (req, res) => {
    // get data (videoId and content)
    const {videoId} = req.params;
    const {content} = req.body;

    // validate data
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid video id");
    }

    if(!content?.trim()){
        throw new ApiError(400, "Please add comment");
    }

    // check video exists or not
    const video = await Video.findById(videoId).select("_id");

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    // add comment
    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user._id
    })

    // return
    return res.status(201).json(
        new ApiResponse(201, comment, "Comment added successfully")
    )
})

const updateComment = asyncHandler(async (req, res) => {
    // get data (commentId and newContent)
    const {commentId} = req.params;
    const {newContent} = req.body;

    // validate data
    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400, "Invalid comment id");
    }

    if(!newContent?.trim()){
        throw new ApiError(400, "Please add new comment");
    }

    // check comment exists or not, if exist then update
    const updatedComment = await Comment.findOneAndUpdate(
        {
            _id: commentId,
            owner: req.user._id
        },
        {
            $set: {
                content: newContent
            }
        },
        {
            new: true
        }
    );

    if(!updatedComment){
        throw new ApiError(404, "Comment not found or you are not allowed to update comment");
    }

    // return 
    return res.status(200).json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
    )
})

const deleteComment = asyncHandler(async (req, res) => {
    // get commentId
    const {commentId} = req.params;

    // validate commentId
    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400, "Invalid comment id");
    }

    // find comment
    const comment = await Comment.findById(commentId).populate("video", "owner");
    
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // delete comment if user is either the comment owner OR the video owner
    if (comment.owner.toString() !== req.user._id && comment.video.owner.toString() !== req.user._id) {
        throw new ApiError(403, "You are not allowed to delete comment");
    }

    // delete
    await Comment.findByIdAndDelete(commentId);

    // return
    return res.status(200).json(
        new ApiResponse(200, null, "Comment deleted succesffully")
    )
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}