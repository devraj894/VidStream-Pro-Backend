import mongoose from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
    // get data
    const {name, description} = req.body;

    // validate data
    if(!name?.trim() || !description?.trim()){
        throw new ApiError(400, "Name and description are required");
    }

    // check same name playlist already exists or not
    const playlistExist = await Playlist.findOne({
        name: name.trim(),
        owner: req.user._id
    })

    if(playlistExist){
        throw new ApiError(400, "Playlist with same name already exists");
    }

    // if not, then create new one
    const playlist = await Playlist.create({
        name: name.trim(),
        description: description.trim(),
        videos: [],
        owner: req.user._id
    })

    if(!playlist){
        throw new ApiError(500, "Failed to create playlist");
    }

    // return 
    return res.status(201).json(
        new ApiResponse(201, playlist, "Playlist created successfully")
    )
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    // get user id
    const {userId} = req.params || req.user._id;

    // validate user id
    if(!mongoose.Types.ObjectId.isValid(userId)){
        throw new ApiError(400, "Invalid user id");
    }

    // aggration piplines
    const playlists = await Playlist.aggregate([
        // filter playlists that belong to the current user
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        // sort playlists by newest first
        {
            $sort: { createdAt: -1 }
        },
        // add a new field "totalVideos" and calculate the length of videos array
        {
            $addFields: {
                totalVideos: { $size: "$videos" }
            }
        },
        // lookup the first video from "videos" collection, to get thumnail for playlist 
        {
            $lookup: {
                from: "videos",
                let: { firstVideoId: { $arrayElemAt: ["$videos", 0] } },
                pipeline: [
                    // match the video whose id equals firstVideoId
                    {
                        $match: {
                            $expr: { $eq: ["$_id", "$$firstVideoId"] }
                        }
                    },
                    // Only select thumbnail field (avoid heavy data)
                    {
                        $project: {
                            thumbnail: 1
                        }
                    }
                ],
                // result will be stored in this array
                as: "previewVideo"
            }
        },
        // extract thumbnail URL safely or if playlist has no videos → previewThumbnail = null
        {
            $addFields: {
                previewThumbnail: {
                    $ifNull: [
                        { $arrayElemAt: ["$previewVideo.thumbnail.url", 0] },
                        null
                    ]
                }
            }
        },
        // Final shape of the response
        {
            $project: {
                name: 1,
                description: 1,
                createdAt: 1,
                totalVideos: 1,
                previewThumbnail: 1
            }
        }
    ]);  

    // return
    return res.status(200).json(
        new ApiResponse(200, playlists, "Playlist fetched successfully")
    )
})

const getPlaylistById = asyncHandler(async (req, res) => {
    // get playlist id
    const {playlistId} = req.params;

    // validate playlist id
    if(!mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400, "Invalid playlist id");
    }

    // find playlist
    const playlist = await Playlist.findById(playlistId)
        .populate("owner", "username fullName avatar")
        .populate("videos", "title thumbnail duration views owner");

    // check exists or not
    if(!playlist){
        throw new ApiError(404, "Playlist not found");
    }    

    // return
    return res.status(200).json(
        new ApiResponse(200, playlist, "Playlist fetched successfully")
    )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    // get data (videoId and playlistId)
    const {videoId, playlistId} = req.params

    // validate data
    if(!mongoose.Types.ObjectId.isValid(videoId) || !mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400, "Invalid video id or playlist id");
    }

    // check playlist exists
    const playlist = await Playlist.findById(playlistId);

    if(!playlist){
        throw new ApiError(404, "Playlist not found");
    }

    // only owner allow to add video from playlist
    if(playlist.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not allowed to add video in this playlist");
    }

    // check video exists and published as well
    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    if(!video.isPublished){
        throw new ApiError(400, "Cannot add unpublished video");
    }

    // check video is already present or not
    if(playlist.videos.includes(videoId)){
        throw new ApiError(400, "Video already in a playlist");
    }

    // add video in playlist
    await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )

    // return
    return res.status(200).json(
        new ApiResponse(200, null, "Video added to playlist successfully")
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    // get data (videoId and playlistId)
    const {videoId, playlistId} = req.params;

    // validate data
    if(!mongoose.Types.ObjectId.isValid(videoId) || !mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400, "Invalid Video id or playlist id");
    }
    // check playlist exist or not
    const playlist = await Playlist.findById(playlistId);

    if(!playlist){
        throw new ApiError(404, "Playlist not found");
    }
    
    // only owner allow to remove video from playlist
    if(playlist.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not allowed to remove video from this playlist");
    }

    // check video exist in playlist or not
    if(!playlist.videos.includes(videoId)){
        throw new ApiError(404, "Video not found in playlist");
    }

    // remove video from playlist
    playlist.videos = playlist.videos.filter(
        (id) => id.toString() !== videoId
    )

    await playlist.save();

    // return 
    return res.status(200).json(
        new ApiResponse(200, null, "Video removed from playlist successfully")
    )
})

const deletePlaylist = asyncHandler(async (req, res) => {
    // get playlist id
    const {playlistId} = req.params;

    // validate playlist id
    if(!mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400, "Invalid playlist id");
    }

    // check playlist exist or not
    const playlist = await Playlist.findById(playlistId);

    if(!playlist){
        throw new ApiError(404, "Playlist not found");
    }

    // ensure operation performed by owner and delete playlist as well
    const deletedPlaylist = await Playlist.findByIdAndDelete({
        _id: playlistId,
        owner:  req.user._id
    });

    if(!deletedPlaylist){
        throw new ApiError(404, "Playlist not found or unauthorized");
    }

    // return
    return res.status(200).json(
        new ApiResponse(200, null, "Playlist deleted successfully")
    )
})

const updatePlaylist = asyncHandler(async (req, res) => {
    // get data (playlistId, name, description)
    const {playlistId} = req.params;
    const {name, description} = req.body;

    // validate data
    if(!mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400, "Playlist id invalid");
    }

    // prepare update object
    const updateFields = {};
    
    if(name?.trim()){
        updateFields.name = name.trim();
    }

    if(description?.trim()){
        updateFields.description = description.trim();
    }

    // prevent empty update
    if(Object.keys(updateFields).length == 0){
        throw new ApiError(400, "Required atleast on field (name or description) to update playlist");
    }

    // update playlist (Ownership check included)
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        {
            _id: playlistId,
            owner: req.user._id
        },
        {
            $set: updateFields
        },
        {
            new: true,
            runValidators: true
        }
    )

    if(!updatedPlaylist){
        throw new ApiError(404, "Playlist not found or you are not authorized");
    }

    // return
    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    )
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}