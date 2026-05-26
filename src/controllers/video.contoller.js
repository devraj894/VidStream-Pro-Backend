import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../services/cloudinaryService.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
    // get data from query
    const {page = 1, limit = 10, query, sortBy, sortType, userId} = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // choose only publish videos
    const match = {
        isPublished: true
    };

    // search
    if(query){
        match.title = {
            $regex: query,
            $options: "i"
        };
    }

    // filter by owner
    if(userId){
        if(!mongoose.Types.ObjectId.isValid(userId)){
            throw new ApiError(400, "Invalid user id");
        }
        match.owner = new mongoose.Types.ObjectId(userId);
    }

    // sorting
    const sortOptions = {};
    if(sortBy){
        sortOptions[sortBy] = sortType === "asc" ? 1 : -1;
    } else{
        sortOptions.createdAt = -1;
    }

    // aggregate pipline
    const aggregate = Video.aggregate([
        {
            $match: match
        },
        {
            $sort: sortOptions
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
         {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ]);

    // apply pagination
    const options = {
        page: pageNumber,
        limit: limitNumber
    }

    const videos = await Video.aggregatePaginate(aggregate, options);

    // return response
    return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"))
})

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
    const { videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid Video Id");
    }

    // fetch enriched video
    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
                isPublished: true
            }
        },

        // owner details
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },

        {
            $unwind: "$owner"
        },

        // likes lookup
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },

        // subscribers lookup
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner._id",
                foreignField: "channel",
                as: "subscribers"
            }
        },

        // computed fields
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },

                isLiked: {
                    $cond: {
                        if: req.user?._id,
                        then: {
                            $in: [
                                req.user._id,
                                "$likes.likedBy"
                            ]
                        },
                        else: false
                    }
                },

                isOwner: {
                    $eq: [
                        "$owner._id",
                        req.user?._id
                    ]
                },

                "owner.subscribersCount": {
                    $size: "$subscribers"
                },

                "owner.isSubscribed": {
                    $cond: {
                        if: req.user?._id,
                        then: {
                            $in: [
                                req.user._id,
                                "$subscribers.subscriber"
                            ]
                        },
                        else: false
                    }
                }
            }
        },

        // final response shape
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                createdAt: 1,
                updatedAt: 1,

                likesCount: 1,
                isLiked: 1,
                isOwner: 1,

                owner: {
                    _id: "$owner._id",
                    username: "$owner.username",
                    fullName: "$owner.fullName",
                    avatar: "$owner.avatar",

                    subscribersCount:
                        "$owner.subscribersCount",

                    isSubscribed:
                        "$owner.isSubscribed"
                }
            }
        }
    ]);

    if (!video.length) {
        throw new ApiError(404, "Video not found");
    }

    // unique view increment
    await Video.findOneAndUpdate(
        {
            _id: videoId,
            viewedBy: { $ne: req.user._id }
        },
        {
            $inc: { views: 1 },
            $push: { viewedBy: req.user._id }
        }
    );

    // update watch history
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $pull: {
                watchHistory: {
                    video: videoId
                }
            }
        }
    );

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $push: {
                watchHistory: {
                    video: videoId,
                    watchedAt: new Date()
                }
            }
        }
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video[0],
                "Video fetched successfully"
            )
        );
});

const getSuggestedVideos = asyncHandler(async (req, res) => {
    // get video id from a params
    const {videoId} = req.params;

    // get loggedIn user id
    const userId = req.user._id;

    // validate video id
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid Video Id");
    }

    // find video
    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "video not found");
    }

    // get user history and video details
    const user = await User.findById(userId).populate("watchHistory.video");

    if(!user){
        throw new ApiError(404, "User not found");
    }

    // get watched video ids
    const watchedVideoIds = user.watchHistory.map(v => v.video?._id).filter(Boolean);

    // get favourite owners
    const favoriteOwners = user.watchHistory.slice(-10).map(v => v.video?.owner).filter(Boolean);

    // get suggested videos based on history and favourite owners
    const suggestions = await Video.aggregate([
        {
            $match: {
                isPublished: true,
                _id: { 
                    $ne: video._id, 
                    $nin: watchedVideoIds 
                },
                 $or: [
                    { 
                        owner: video.owner 
                    }, 
                    { 
                        owner: { 
                            $in: favoriteOwners 
                        } 
                    }, 
                    { 
                        title: {
                            $regex: video.title, 
                            $options: "i" 
                        } 
                    } 
                ]
            }
        },
        {
            $sort: {
                views: -1
            }
        },
        {
            $limit: 10
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
         {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ]);

    // return
    return res.status(200).json(
        new ApiResponse(200, suggestions, "Suggested videos fetched successfully")
    );
})

const updateVideo = asyncHandler(async (req, res) => {
    // get video id from params
    const {videoId} = req.params;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid Video Id")
    }

    // search video in db
    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    // owner authorization check
    if(video.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not authorized to update this video");
    }

    // get title, description and thumbnail to update
    const {title, description} = req.body || {};
    const thumbnailPath = req.file?.path;

    if(!title && !description && !thumbnailPath){
        throw new ApiError(400, "Atleast one detail is required to update");
    }

    // update title, description, thumbnail
    if(title){
        video.title = title;
    }
    
    if(description){
        video.description = description;
    }

    if(thumbnailPath){
        const uploadedThumbnail = await uploadOnCloudinary(thumbnailPath);

        if(!uploadedThumbnail){
            throw new ApiError(500, "Failed to upload thumbnail");
        }

        await deleteOnCloudinary(video.thumbnail.public_id);

        video.thumbnail = {
            url: uploadedThumbnail.url,
            public_id: uploadedThumbnail.public_id
        };
    }

    // save to db
    await video.save({validateBeforeSave: false});

    // return response
    return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
})

const deleteVideo = asyncHandler(async (req, res) => {
    // get video id from params
    const {videoId} = req.params;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid Video Id");
    }

    // find video
    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    // owner authorization check
    if(video.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not authorized to update this video");
    }

    // delete video from cloudinary
    if(video.thumbnail?.public_id) await deleteOnCloudinary(video.thumbnail.public_id, "image");
    if(video.videoFile?.public_id) await deleteOnCloudinary(video.videoFile.public_id, "video");

    // delete video data from db
    await Video.findByIdAndDelete(videoId);

    // return response
    return res
    .status(200)
    .json(new ApiResponse(200, null, "Video deleted successfully"));
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    // get video id from params
    const {videoId} = req.params;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid Video Id")
    }

    // search video in db
    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    // owner authorization check
    if(video.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not authorized to update this video");
    }

    // update toggel in db
    video.isPublished = !video.isPublished

    // save to db
    await video.save({validateBeforeSave: false});

    // return response
    return res
    .status(200)
    .json(new ApiResponse(200, video, "Video publish status updated successfully"));
})

export { 
    getAllVideos, 
    publishAVideo, 
    getVideoById,
    getSuggestedVideos, 
    updateVideo, 
    deleteVideo, 
    togglePublishStatus 
};