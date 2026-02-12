import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../services/cloudinaryService.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const publishAVideo = asyncHandler(async (req, res) => {
    // get title and description
    const {title, description} = req.body;

    if(!title || !description){
        throw new ApiError(400, "title or description is missing");
    }
    
    // get video and thumbnail
    const videoLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if(!videoLocalPath || !thumbnailLocalPath){
        throw new ApiError(400, "Video file or thumbnail is missing");
    }

    // upload video and thumbnail on cloudinary
    const uploadedVideo = await uploadOnCloudinary(videoLocalPath);

    if(!uploadedVideo){
        throw new ApiError(500, "Video upload failed");
    }

    const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if(!uploadedThumbnail){
        await deleteOnCloudinary(uploadedVideo.public_id);
        throw new ApiError(500, "Video upload failed");
    }

    // create video
    const video = await Video.create({
        title,
        description,
        duration: uploadedVideo.duration || 0,
        videoFile: {
            url: uploadedVideo.url,
            public_id: uploadedVideo.public_id
        },
        thumbnail: {
            url: uploadedThumbnail.url,
            public_id: uploadedThumbnail.public_id
        },
        owner: req.user._id
    })

    // retrun response
    return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"))
})

const getVideoById = asyncHandler(async (req, res) => {
    // get video id from a params
    const {videoId} = req.params;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid Video Id");
    }

    // search in DB for video id
    const video = await Video.findById(videoId).populate("owner", "username avatar");

    if(!video || !video.isPublished){
        throw new ApiError(404, "video not found");
    }

    // increament view on that video
    // TODO: Unique view tracking can be implemented using separate view collection.
    video.views += 1;

    // save updated video to DB
    await video.save({validateBeforeSave: false});

    // return response
    return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"))
})

export { publishAVideo, getVideoById };