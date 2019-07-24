let WebSocketServer = require("websocket").server;
let http = require("http");
let localIP = require("./node_modules/local-ip");


const MyMAC = "74:2f:68:9d:59:97";
let MyIP = localIP.MACtoIPv4(MyMAC);
if (MyIP.err) {
    console.error(MyIP.err);
}
MyIP = MyIP.ip;
const ListenPort = 34100;

let Server = http.createServer(function(request, response) {
    //autoimplemented
});
Server.listen(ListenPort, MyIP, function() {
    console.log("Server started listening on " + MyIP + ":" + ListenPort);
});

let WsServer = new WebSocketServer({
    httpServer: Server
});

function Sock(Con) {
    let socket = Con.socket;
    return socket.remoteAddress + ":" + socket.remotePort;
}

let ColorPool = ["red", "green", "blue", "yellow", "orange", "pink", "cyan"];
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
shuffleArray(ColorPool);

const BaseLength = 4;
let Players = [];
let Food = [];
let Speed = 5;
const Despawn = 10;
let Dead = [];
const GridData = {
    Height: 32,
    Width: 32
}


function Player(Con, Username, Color, Head) {
    this.Con = Con;
    this.Username = Username;
    this.Color = Color;
    this.Head = Head;
    this.Body = [];
    this.Length = BaseLength;
    this.Direction = 0; // 0 - right, 1 - up, 2 - left, 3 - down
    this.PrevDirection = 0;
    this.Alive = true;
    return this;
}

function Block(Type, X, Y) {
    this.Type = Type;
    this.X = X;
    this.Y = Y;
}

WsServer.on('request', function(request) {
    if (ColorPool.length == 0) {
        request.reject(503, "Server full.");
        return;
    }
    let Connection = request.accept(null, request.origin);
    console.log("User " + Sock(Connection)  + " connected to server.");

    let InitPacket = {
        type: "init",
        grid_w: GridData.Width,
        grid_h: GridData.Height
    }
    let InitMsg = JSON.stringify(InitPacket);
    Connection.sendUTF(InitMsg);
    console.log(">> " + InitMsg);

    Connection.on('message', function(message) {
        if (message.type === 'utf8') {
            let Packet = JSON.parse(message.utf8Data);
            let Response;
            let Msg;
            switch (Packet.type) {
                case "auth":
                    console.log("<< Auth from " + Sock(Connection) + ". Desired username: " + Packet.username);
                    let Taken = false;
                    let Socks = Object.keys(Players);
                    for (let i = 0; i < Socks.length; ++i) {
                        if (Players[Socks[i]].Username == Packet.username) {
                            Taken = true;
                            break;
                        }
                    }
                    if (!Taken && ColorPool.length > 0) {
                        let SpawnCoords = new Block("Head", 0, 0);
                        do {
                            SpawnCoords.X = GridData.Width / 2 + Math.floor(GridData.Width / 2 * (Math.random() - 0.5));
                            SpawnCoords.Y = GridData.Height / 2 + Math.floor(GridData.Height / 2 * (Math.random() - 0.5));
                        } while (!CheckFree(SpawnCoords.X, SpawnCoords.Y));
                        Players[Sock(Connection)] = new Player(Connection, Packet.username, ColorPool.pop(),
                        new Block("Head", SpawnCoords.X, SpawnCoords.Y));
                        Response = {
                            type: "auth",
                            success: true,
                            username: Packet.username
                        }
                        Msg = JSON.stringify(Response);
                        Connection.sendUTF(Msg);
                        console.log(">> " + Msg);
                    } else {
                        if (ColorPool.length == 0) {
                            Response = {
                                type: "auth",
                                success: false,
                                err: "Server is full. Try again later."
                            }
                            Msg = JSON.stringify(Response);
                            Connection.sendUTF(Msg);
                            console.log(">> " + Msg);
                            console.log("Disconnected " + Sock(Connection));
                            Connection.close();
                            return;
                        }
                        Response = {
                            type: "auth",
                            success: false,
                            err: "Username taken."
                        }
                        Msg = JSON.stringify(Response);
                        Connection.sendUTF(Msg);
                        console.log(">> " + Msg);
                    }
                    break;
                case "direction":
                    console.log("<< Input direction: " + Packet.dir);
                    if (Packet.dir == Players[Sock(Connection)].Direction) return;
                    if (Packet.dir == Players[Sock(Connection)].PrevDirection - 2 ||
                    Packet.dir == Players[Sock(Connection)].PrevDirection + 2) return;
                    Players[Sock(Connection)].Direction = Packet.dir;
                    break;
            }
        }
    });

    Connection.on("close", function() {
        console.log(Sock(Connection) + " disconnected.");
        ColorPool.push(Players[Sock(Connection)].Color);
        delete Players[Sock(Connection)];
    });

});

function NextStep(Player) {
    let Step = new Block("Step", Player.Head.X, Player.Head.Y);
    switch (Player.Direction) {
        case 0:
            Step.X++;
            break;
        case 1:
            Step.Y--;
            break;
        case 2:
            Step.X--;
            break;
        case 3:
            Step.Y++;
            break;
    }
    if (Step.X < 0 || Step.X >= GridData.Width) Step.X = -1;
    if (Step.Y < 0 || Step.Y >= GridData.Height) Step.Y = -1;
    return Step;
}

function CheckFree(X, Y) {
    for (let i = 0; i < Food.length; ++i) {
        if (Food[i].X == X && Food[i].Y == Y) return false;
    }
    let Keys = Object.keys(Players);
    for (let i = 0; i < Keys.length; ++i) {
        if (Players[Keys[i]].Head.X == X && Players[Keys[i]].Head.Y == Y) return false;
        for (let j = 0; j < Players[Keys[i]].Body.length; ++j) {
            if (Players[Keys[i]].Body[j].X == X && Players[Keys[i]].Body[j].Y == Y) return false;
        }
    }
    for (let i = 0; i < Dead.length; ++i) {
        if (Dead[i].X == X && Dead[i].Y == Y) return false;
    }
    return true;
}

function Lose(Player) {
    if (!Player.Alive) return;
    Player.Alive = false;
    Dead.push(new Block("Dead", Player.Head.X, Player.Head.Y));
    Player.Body.forEach(function(b) {
        Dead.push(new Block("Dead", b.X, b.Y));
    });
    let Packet = {
        type: "lose"
    }
    Packet.score = Player.Length - BaseLength;
    let Msg = JSON.stringify(Packet);
    Player.Con.sendUTF(Msg);
    console.log(">> " + Msg);
}

let GameLoop = setInterval(function() {
    let Keys = Object.keys(Players);
    Keys.forEach(function(Key) {
        if (!Players[Key].Alive) return;
        let Next = NextStep(Players[Key]);
        if (Next.X == -1 || Next.Y == -1) {
            Lose(Players[Key]);
            return;
        }
        if (!CheckFree(Next)) {
            Lose(Players[Key]);
            return;
        }
        let Stalemate = false;
        Keys.forEach(function(k) {
            if (k == Key || Stalemate) return;
            if (Next == NextStep(Players[k])) Stalemate = true;
        });
        if (Stalemate) {
            Lose(Players[Key]);
            return;
        }
        Players[Key].PrevDirection = Players[Key].Direction;
        // TODO: food pick up
        

    });
}, 1000 * (1 / Speed));