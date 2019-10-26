"use strict"
document.addEventListener('DOMContentLoaded', function(event) {
    window.WebSocket = window.WebSocket || window.MozWebsocket;

    let Canvas = document.getElementById("main-canvas");
    let Ctx = Canvas.getContext("2d");
    Canvas.focus();
    const CanvasData = {
        BgColor: "#000000",
        Width: 512,
        Height: 512,
        OutlineColor: "#303030",
        PlayerHighlightColor: "#00ff00",
        DeadColor: "#636363",
        FoodColor: "#ffffff"
    };
    CanvasData.Ratio = CanvasData.Width / CanvasData.Height;
    const GridData = {
        Height: null,
        Width: null,
        Outline: 1
    }

    // MATH extension
    Math.clamp = function(num, min, max) {
        return(Math.max(min, Math.min(num, max)));
    }

    // draw
    function DrawRect(X, Y, Color, Outline = CanvasData.OutlineColor) {
        let x = X * CanvasData.Width / GridData.Width;
        let y = Y * CanvasData.Height / GridData.Height;
        if (GridData.Outline > 0) {
            Ctx.fillStyle = Outline;
        } else {
            Ctx.fillStyle = Color;
        }
        let W = CanvasData.Width / GridData.Width;
        let H = CanvasData.Height / GridData.Height;
        Ctx.fillRect(x, y, W, H);
        if (GridData.Outline > 0) {
            Ctx.fillStyle = Color;
            Ctx.fillRect(
                Math.clamp(x + GridData.Outline, x, x + W / 2),
                Math.clamp(y + GridData.Outline, y, y + H / 2),
                Math.clamp(W - GridData.Outline * 2, 0, W),
                Math.clamp(H - GridData.Outline * 2, 0, H)
            );
        }
    }
    function DrawLabel(X, Y, Text, Color) {
        Ctx.font = "16px Comic Sans MS";
        Ctx.fillStyle = Color;
        Ctx.strokeStyle = "#000000";
        Ctx.textAlign = "center"
        let x = (X + 0.5) * CanvasData.Width / GridData.Width;
        let y = (Y + 2) * CanvasData.Height / GridData.Height;
        Ctx.strokeText(Text, x, y);
        Ctx.fillText(Text, x, y);
    }


    const ServerIP = "%DEF_IP%";

    let WSProtocol = (location.protocol == "https:")?"wss:":"ws:";
    let Connection = new WebSocket(`${WSProtocol}//${ServerIP}`);
    let Username = null;

    Connection.onopen = function(event) {
        console.log("Connected to " + Connection.url + ". Ready to use.");
    }

    Connection.onerror = function(error) {
        console.error("Connection error occured.");
    }

    Connection.onmessage = function(message) {
        let Packet;
        try {
            Packet = JSON.parse(message.data);
        } catch (err) {
            console.error("Error parsing received message. " + message.data);
            return;
        }
        switch (Packet.type) {
            case "init":
                GridData.Width = Packet.grid_w;
                GridData.Height = Packet.grid_h;
                // auth
                let DesiredUsername = prompt("Enter your name.", "%DEF_USERNAME%");
                let AuthPacket = {
                    type: "auth",
                    username: DesiredUsername
                }
                let Msg = JSON.stringify(AuthPacket);
                Connection.send(Msg);
                console.log(">> " + Msg);
                break;
            case "auth":
                if (Packet.success) {
                    Username = Packet.username;
                } else {
                    alert(Packet.err);
                    Connection.close();
                    return;
                }
                break;
            case "gamestate":
                Ctx.fillStyle = CanvasData.BgColor;
                Ctx.fillRect(0, 0, CanvasData.Width, CanvasData.Height);
                Packet.food.forEach(function(food) {
                    DrawRect(food.X, food.Y, CanvasData.FoodColor);
                });
                Packet.dead.forEach(function(b) {
                    DrawRect(b.X, b.Y, CanvasData.DeadColor)
                });
                Packet.snakes.forEach(function(snake) {
                    DrawRect(snake.head.X, snake.head.Y, snake.color, CanvasData.OutlineColor);
                    snake.body.forEach(function(b) {
                        DrawRect(b.X, b.Y, snake.color, CanvasData.OutlineColor);
                    });
                    DrawLabel(snake.head.X, snake.head.Y, snake.name,
                        (snake.name == Username)?CanvasData.PlayerHighlightColor:"#ffffff");
                });
                break;
            case "lose":
                alert("You lost! Your score: " + Packet.score);
                break;
        }
    }

// INPUT

function SendDir(Direction) {
    let DirPacket = {
        type: "direction",
        dir: Direction
    };
    let Msg = JSON.stringify(DirPacket);
    Connection.send(Msg);
    console.log(">> " + Msg);
}

document.body.addEventListener("keydown", function(event) {
    if (document.activeElement == Canvas && event.key == ' ') {
        event.preventDefault();
    }
});
Canvas.addEventListener("keydown", function(event) { // WASD keyboard input
    switch(event.key) {
        case 'd':
            SendDir(0);
            break;
        case 'w':
            SendDir(1);
            break;
        case 'a':
            SendDir(2);
            break;
        case 's':
            SendDir(3);
            break;
    }
});

document.body.addEventListener("touchstart", function(event) { // prevent touch gestures
    if (event.target == Canvas) event.preventDefault();
});
Canvas.addEventListener("touchstart", function(event) { // touch input
    let Rect = Canvas.getBoundingClientRect();
    let Touch = {
        X: event.touches[0].clientX - Rect.left,
        Y: event.touches[0].clientY - Rect.top
    }
    if (Touch.X > Touch.Y * CanvasData.Ratio) { // top right triangle
        if (Touch.Y > CanvasData.Height - Touch.X / CanvasData.Ratio) { // bottom right triangle
            SendDir(0);
        } else { // top left triangle
            SendDir(1);
        }
    } else { // bottom left triangle
        if (Touch.Y > CanvasData.Height - Touch.X / CanvasData.Ratio) { // bottom right triangle
            SendDir(3);
        } else { // top left triangle
            SendDir(2);
        }
    }
});

});