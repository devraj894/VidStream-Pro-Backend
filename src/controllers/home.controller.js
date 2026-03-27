import { Video } from "../models/video.model";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

const getHomeFeed = asyncHandler(async (req, res) => {
    // date ranges
    const last7days = new Date();
    last7days.setDate(last7days.getDate() - 7);

    // trending (recent + popular)
    const trendingPromise = Video.aggregate([
        {
            $match: {
                isPublished: true,
                createdAt: {
                    $gte: last7days
                }
            }
        },
        {
            $sort: {
                views: -1,
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
                as: "Owner",
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
            $unwind: "$Owner"
        }
    ])

    // parellel execution
    let [trending] = await Promise.all([
        trendingPromise
    ]);

    // return
    return res.status(200).json(
        new ApiResponse(200, {
            sections: [
                {title: "Trending", videos: trending}
            ]
        }, "Home feed fetched successfully")
    );
});

export {
    getHomeFeed
}