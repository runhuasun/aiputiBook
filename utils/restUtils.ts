// 用来处理restful问题的函数集

export function getImageRest(roomId:string|null){
    return roomId ? `/images/${roomId}` : '#';
}

export function getBookRest(bookId:string|null){
    return bookId ? `/books/${bookId}` : '#';
}

export function getVideoRest(roomId:string|null){
    return roomId ? `/videos/${roomId}` : '#';
}

export function getAudioRest(roomId:string|null){
    return roomId ? `/audios/${roomId}` : '#';
}
