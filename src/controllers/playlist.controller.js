import mongoose from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    const {userId} = req.params;

    // validate user id
    if(!mongoose.Types.ObjectId.isValid(userId)){
        throw new ApiError(400, "Invalid user id");
    }

    // find playlist
    const playlist = await Playlist.find({owner: req.user._id}).sort({createdAt: -1});

    // return
    return res.status(200).json(
        new ApiResponse(200, playlist, "Playlist fetched successfully")
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

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById
}