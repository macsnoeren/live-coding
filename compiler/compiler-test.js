const cc = require('./compiler');

cc.connect().then( (socketId) => {
    

    // For automatic testing
    cc.create("client-id-123", "MyJavaApplication");
    cc.sendFile("client-id-123", "myjavaapplication.java", `
import static java.lang.System.*;
import java.util.Scanner;

class MyJavaApplication {
    public static void main(String[] args) {
        System.out.println("Hello, World!"); 
        Scanner scanner = new Scanner(System.in);
        for ( int i=0; i < 2; i++ ) {
            System.out.println( scanner.nextLine() );
        }
    }
}
`);
    
    cc.compile("client-id-123");
    setTimeout(() => {cc.run("client-id-123");}, 2000);    
    setTimeout(() => {cc.stdin("client-id-123", "test\n");}, 4000);    
    setTimeout(() => {cc.stdin("client-id-123", "test\n");}, 6000);    
    setTimeout(() => {cc.stdin("client-id-123", "test\n");}, 8000);    
    setTimeout(() => {cc.stdin("client-id-123", "test\n");}, 10000);    
    setTimeout(() => {cc.stdin("client-id-123", "test\n");}, 12000);    
    setTimeout(() => {cc.cleanup("client-id-123");}, 14000);
    
});
